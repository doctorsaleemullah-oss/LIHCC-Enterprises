import { prisma } from "./prisma";
import { round2 } from "./format";
import { customerOutstanding, vendorOutstanding, accountBalance, ACCOUNTS } from "./accounting";

export type DateRange = { from?: Date; to?: Date };

function saleWhere(range?: DateRange) {
  return {
    status: "POSTED" as const,
    ...(range?.from || range?.to
      ? {
          transactionDate: {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          },
        }
      : {}),
  };
}

function purchaseWhere(range?: DateRange) {
  return {
    status: "POSTED" as const,
    ...(range?.from || range?.to
      ? {
          transactionDate: {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          },
        }
      : {}),
  };
}

export async function dashboardStats(range?: DateRange) {
  const [sales, purchases, expenses, products, pendingInvoices, consignments] = await Promise.all([
    prisma.sale.findMany({
      where: saleWhere(range),
      include: { customer: true, items: { include: { product: true } } },
    }),
    prisma.purchase.findMany({ where: purchaseWhere(range), include: { vendor: true } }),
    prisma.expense.findMany({ where: { status: "POSTED", ...(range?.from || range?.to ? { transactionDate: { gte: range?.from, lte: range?.to } } : {}) } }),
    prisma.product.findMany({ include: { lots: true, category: true } }),
    prisma.sale.findMany({ where: { status: "POSTED", paymentStatus: { in: ["UNPAID", "PARTIAL"] } }, take: 8, orderBy: { transactionDate: "desc" }, include: { customer: true } }),
    prisma.consignment.findMany({ where: { status: { not: "VOIDED" } }, include: { items: true, customer: true } }),
  ]);

  const totalSales = round2(sales.reduce((s, x) => s + x.total, 0));
  const totalCost = round2(sales.reduce((s, x) => s + x.totalCost, 0));
  const grossProfit = round2(sales.reduce((s, x) => s + x.grossProfit, 0));
  const totalPurchases = round2(purchases.reduce((s, x) => s + x.total, 0));
  const totalExpenses = round2(expenses.reduce((s, x) => s + x.amount, 0));
  const netProfit = round2(grossProfit - totalExpenses);

  const customers = await prisma.customer.findMany({ where: { isActive: true } });
  const vendors = await prisma.vendor.findMany({ where: { isActive: true } });
  let receivables = 0;
  for (const c of customers) receivables += await customerOutstanding(c.id);
  let payables = 0;
  for (const v of vendors) payables += await vendorOutstanding(v.id);

  const inventoryValue = round2(
    products.reduce(
      (s, p) => s + p.lots.filter((l) => l.qtyRemaining > 0).reduce((a, l) => a + l.qtyRemaining * l.unitCost, 0),
      0,
    ),
  );
  const lowStock = products
    .map((p) => {
      const onHand = p.lots.filter((l) => l.location === "ON_HAND").reduce((s, l) => s + l.qtyRemaining, 0);
      return { ...p, onHand };
    })
    .filter((p) => p.onHand <= p.minStock);

  const consignmentStock = consignments.reduce(
    (s, c) => s + c.items.reduce((a, i) => a + Math.max(0, i.qtySupplied - i.qtyUsed - i.qtyReturned), 0),
    0,
  );

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todaySales = await prisma.sale.aggregate({
    where: { status: "POSTED", transactionDate: { gte: startOfToday } },
    _sum: { total: true },
  });
  const todayPurchases = await prisma.purchase.aggregate({
    where: { status: "POSTED", transactionDate: { gte: startOfToday } },
    _sum: { total: true },
  });

  const recent = await prisma.auditLog.findMany({
    take: 12,
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  const monthly = monthlySeries(sales, purchases);
  const topItems = topSelling(sales);
  const customerSales = customerWise(sales);
  const vendorPurchases = vendorWise(purchases);

  const cash = await accountBalance(ACCOUNTS.CASH);
  const bank = await accountBalance(ACCOUNTS.BANK);

  return {
    totalSales,
    totalPurchases,
    totalCost,
    grossProfit,
    totalExpenses,
    netProfit,
    receivables: round2(receivables),
    payables: round2(payables),
    inventoryValue,
    lowStock,
    consignmentStock,
    pendingInvoices,
    todaySales: todaySales._sum.total || 0,
    todayPurchases: todayPurchases._sum.total || 0,
    recent,
    monthly,
    topItems,
    customerSales,
    vendorPurchases,
    cash,
    bank,
    salesCount: sales.length,
  };
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthlySeries(sales: { transactionDate: Date; total: number; grossProfit: number }[], purchases: { transactionDate: Date; total: number }[]) {
  const map = new Map<string, { sales: number; purchases: number; profit: number }>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    map.set(monthKey(d), { sales: 0, purchases: 0, profit: 0 });
  }
  for (const s of sales) {
    const k = monthKey(s.transactionDate);
    const row = map.get(k);
    if (row) {
      row.sales += s.total;
      row.profit += s.grossProfit;
    }
  }
  for (const p of purchases) {
    const k = monthKey(p.transactionDate);
    const row = map.get(k);
    if (row) row.purchases += p.total;
  }
  return [...map.entries()].map(([month, v]) => ({
    month,
    sales: round2(v.sales),
    purchases: round2(v.purchases),
    profit: round2(v.profit),
  }));
}

function topSelling(sales: { items: { product: { name: string }; quantity: number; lineTotal: number; profitAmount: number }[] }[]) {
  const map = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
  for (const s of sales) {
    for (const it of s.items) {
      const cur = map.get(it.product.name) || { name: it.product.name, qty: 0, revenue: 0, profit: 0 };
      cur.qty += it.quantity;
      cur.revenue += it.lineTotal;
      cur.profit += it.profitAmount;
      map.set(it.product.name, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
}

function customerWise(sales: { customer: { name: string }; total: number; grossProfit: number }[]) {
  const map = new Map<string, { name: string; sales: number; profit: number }>();
  for (const s of sales) {
    const cur = map.get(s.customer.name) || { name: s.customer.name, sales: 0, profit: 0 };
    cur.sales += s.total;
    cur.profit += s.grossProfit;
    map.set(s.customer.name, cur);
  }
  return [...map.values()].sort((a, b) => b.sales - a.sales).slice(0, 8);
}

function vendorWise(purchases: { vendor: { name: string }; total: number }[]) {
  const map = new Map<string, { name: string; purchases: number }>();
  for (const p of purchases) {
    const cur = map.get(p.vendor.name) || { name: p.vendor.name, purchases: 0 };
    cur.purchases += p.total;
    map.set(p.vendor.name, cur);
  }
  return [...map.values()].sort((a, b) => b.purchases - a.purchases).slice(0, 8);
}

export async function globalSearch(q: string) {
  const term = q.trim();
  if (term.length < 2) return { sales: [], purchases: [], products: [], customers: [], vendors: [], consignments: [], payments: [] };
  const contains = { contains: term };
  const [sales, purchases, products, customers, vendors, consignments, payments] = await Promise.all([
    prisma.sale.findMany({ where: { OR: [{ number: contains }, { referenceNumber: contains }, { notes: contains }] }, take: 8, include: { customer: true } }),
    prisma.purchase.findMany({ where: { OR: [{ number: contains }, { referenceNumber: contains }] }, take: 8, include: { vendor: true } }),
    prisma.product.findMany({
      where: {
        OR: [{ name: contains }, { code: contains }, { catalogueNumber: contains }, { brand: contains }, { genericName: contains }],
      },
      take: 8,
    }),
    prisma.customer.findMany({ where: { OR: [{ name: contains }, { code: contains }, { organization: contains }, { phone: contains }] }, take: 8 }),
    prisma.vendor.findMany({ where: { OR: [{ name: contains }, { code: contains }, { companyName: contains }, { phone: contains }] }, take: 8 }),
    prisma.consignment.findMany({ where: { OR: [{ number: contains }] }, take: 8, include: { customer: true } }),
    prisma.payment.findMany({ where: { OR: [{ number: contains }, { referenceNumber: contains }] }, take: 8 }),
  ]);
  const byBatch = await prisma.inventoryLot.findMany({
    where: { OR: [{ batchNumber: contains }, { serialNumber: contains }] },
    take: 8,
    include: { product: true },
  });
  return { sales, purchases, products, customers, vendors, consignments, payments, lots: byBatch };
}
