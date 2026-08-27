import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLE_PERMISSIONS } from "../src/lib/permissions";
import { createLot, allocateCost, consumeLayers } from "../src/lib/inventory";
import { ACCOUNTS, postJournal } from "../src/lib/accounting";
import { randomToken } from "../src/lib/audit";
import { round2 } from "../src/lib/format";

const prisma = new PrismaClient();

function d(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0);
}

async function main() {
  const existing = await prisma.user.findFirst();
  if (existing) {
    console.log("Database already seeded.");
    return;
  }

  await prisma.glAccount.createMany({
    data: [
      { code: ACCOUNTS.CASH, name: "Cash on Hand", type: "ASSET" },
      { code: ACCOUNTS.BANK, name: "Bank Accounts", type: "ASSET" },
      { code: ACCOUNTS.AR, name: "Accounts Receivable", type: "ASSET" },
      { code: ACCOUNTS.INVENTORY, name: "Inventory — On Hand", type: "ASSET" },
      { code: ACCOUNTS.INVENTORY_CONSIGNED, name: "Inventory — Consigned", type: "ASSET" },
      { code: ACCOUNTS.AP, name: "Accounts Payable", type: "LIABILITY" },
      { code: ACCOUNTS.TAX_PAYABLE, name: "Tax Payable", type: "LIABILITY" },
      { code: ACCOUNTS.OPENING_EQUITY, name: "Opening Balance Equity", type: "EQUITY" },
      { code: ACCOUNTS.RETAINED, name: "Retained Earnings", type: "EQUITY" },
      { code: ACCOUNTS.SALES, name: "Sales Revenue", type: "REVENUE" },
      { code: ACCOUNTS.SALES_RETURNS, name: "Sales Returns", type: "REVENUE" },
      { code: ACCOUNTS.DISCOUNT_GIVEN, name: "Discounts Given", type: "REVENUE" },
      { code: ACCOUNTS.COGS, name: "Cost of Goods Sold", type: "EXPENSE" },
      { code: ACCOUNTS.PURCHASE_RETURNS, name: "Purchase Returns", type: "EXPENSE" },
      { code: ACCOUNTS.DISCOUNT_RECEIVED, name: "Discounts Received", type: "REVENUE" },
      { code: ACCOUNTS.EXPENSES, name: "Operating Expenses", type: "EXPENSE" },
    ],
  });

  const roles = [];
  for (const [name, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    roles.push(
      await prisma.role.create({
        data: {
          name,
          description: name,
          isSystem: true,
          permissions: JSON.stringify(perms),
        },
      }),
    );
  }
  const adminRole = roles.find((r) => r.name === "Super Administrator")!;
  const accountantRole = roles.find((r) => r.name === "Accountant")!;
  const inventoryRole = roles.find((r) => r.name === "Inventory Manager")!;
  const salesRole = roles.find((r) => r.name === "Sales User")!;
  const viewerRole = roles.find((r) => r.name === "Viewer")!;

  const admin = await prisma.user.create({
    data: {
      username: "admin",
      name: "System Administrator",
      email: "admin@lihccenterprises.local",
      passwordHash: await bcrypt.hash("Admin@123", 10),
      roleId: adminRole.id,
    },
  });
  await prisma.user.createMany({
    data: [
      { username: "accountant", name: "Accounts Officer", passwordHash: await bcrypt.hash("Accounts@123", 10), roleId: accountantRole.id },
      { username: "inventory", name: "Inventory Manager", passwordHash: await bcrypt.hash("Stock@123", 10), roleId: inventoryRole.id },
      { username: "sales", name: "Sales User", passwordHash: await bcrypt.hash("Sales@123", 10), roleId: salesRole.id },
      { username: "viewer", name: "Read Only", passwordHash: await bcrypt.hash("Viewer@123", 10), roleId: viewerRole.id },
    ],
  });

  await prisma.company.create({
    data: {
      id: "default",
      name: "LIHCC Enterprises",
      legalName: "LIHCC Enterprises",
      address: "Adjacent to Luqman Cardiac Center",
      city: "Pakistan",
      phone: "",
      whatsapp: "",
      email: "",
      description: "Supplier of medical and cardiology-related items to Luqman Cardiac Center, hospitals, clinics and registered customers.",
      invoiceFooter: "Thank you for your business. Goods remain the property of LIHCC Enterprises until fully paid.",
      termsAndConditions:
        "1. Payment is due as per agreed terms.\n2. Please quote the invoice number on all payments.\n3. Claims regarding shortage or damage must be reported within 48 hours of delivery.\n4. Consigned items remain the property of LIHCC Enterprises until consumed and billed.",
      authorizedName: "Authorized Signatory",
      authorizedTitle: "Proprietor",
      costingMethod: "FIFO",
      currency: "PKR",
      currencySymbol: "Rs",
    },
  });

  await prisma.bankAccount.createMany({
    data: [
      { name: "Cash in Hand", isCash: true, openingBalance: 0 },
      { name: "Business Bank Account", bankName: "Bank", isCash: false, openingBalance: 0 },
    ],
  });

  const cash = await prisma.bankAccount.findFirst({ where: { isCash: true } });

  await prisma.paymentMethod.createMany({
    data: [
      { name: "Cash", kind: "cash" },
      { name: "Bank Transfer", kind: "bank" },
      { name: "Cheque", kind: "cheque" },
      { name: "Online Payment", kind: "online" },
      { name: "Credit", kind: "credit" },
    ],
  });

  await prisma.expenseCategory.createMany({
    data: [
      { name: "Freight & Logistics" },
      { name: "Office & Admin" },
      { name: "Utilities" },
      { name: "Salaries" },
      { name: "Bank Charges" },
      { name: "Miscellaneous" },
    ],
  });

  const units = await Promise.all(
    ["Piece", "Box", "Pack", "Set", "Unit"].map((name) => prisma.unit.create({ data: { name } })),
  );
  const piece = units[0];

  const catNames = [
    "Coronary stents",
    "Balloons",
    "PTCA wires",
    "Catheters",
    "Sheaths",
    "Guidewires",
    "Medical consumables",
    "Other medical equipment/items",
  ];
  const cats = [];
  for (const name of catNames) cats.push(await prisma.category.create({ data: { name } }));
  const byName = Object.fromEntries(cats.map((c) => [c.name, c]));

  const lihcc = await prisma.customer.create({
    data: {
      code: "CUS-0001",
      name: "Luqman Cardiac Center",
      organization: "Luqman Cardiac Center (LIHCC)",
      contactPerson: "Purchase Department",
      paymentTerms: "Monthly settlement",
      notes: "Dedicated institutional account. Consignment and billed supplies.",
      isDedicatedLihcc: true,
    },
  });
  await prisma.customer.createMany({
    data: [
      { code: "CUS-0002", name: "City Heart Clinic", organization: "City Heart Clinic", paymentTerms: "Net 30" },
      { code: "CUS-0003", name: "Regional Medical Center", organization: "Regional Medical Center", paymentTerms: "Net 15" },
    ],
  });

  const vendorA = await prisma.vendor.create({
    data: {
      code: "VEN-0001",
      name: "MediSupply International",
      companyName: "MediSupply International",
      contactPerson: "Sales Desk",
      paymentTerms: "Cash / Credit",
      notes: "Primary importer of coronary stents and balloons.",
    },
  });
  const vendorB = await prisma.vendor.create({
    data: {
      code: "VEN-0002",
      name: "CardioTech Distributors",
      companyName: "CardioTech Distributors",
      paymentTerms: "Cash",
    },
  });

  const products = [
    {
      code: "ITM-0001",
      name: "Drug Eluting Coronary Stent 2.75 x 18 mm",
      genericName: "DES",
      categoryId: byName["Coronary stents"].id,
      brand: "CardioStent",
      catalogueNumber: "DES-275-18",
      purchasePrice: 52000,
      sellingPrice: 62000,
      minStock: 2,
    },
    {
      code: "ITM-0002",
      name: "Drug Eluting Coronary Stent 3.0 x 23 mm",
      genericName: "DES",
      categoryId: byName["Coronary stents"].id,
      brand: "CardioStent",
      catalogueNumber: "DES-300-23",
      purchasePrice: 54000,
      sellingPrice: 65000,
      minStock: 2,
    },
    {
      code: "ITM-0003",
      name: "PTCA Balloon 2.5 x 15 mm",
      genericName: "PTCA Balloon",
      categoryId: byName["Balloons"].id,
      brand: "FlexBalloon",
      catalogueNumber: "BAL-250-15",
      purchasePrice: 12000,
      sellingPrice: 16000,
      minStock: 4,
    },
    {
      code: "ITM-0004",
      name: "PTCA Guidewire 0.014\" 180 cm",
      genericName: "PTCA wire",
      categoryId: byName["PTCA wires"].id,
      brand: "WirePro",
      catalogueNumber: "WIR-014-180",
      purchasePrice: 4500,
      sellingPrice: 6500,
      minStock: 10,
    },
    {
      code: "ITM-0005",
      name: "Judkins Right Catheter 6F",
      genericName: "Diagnostic catheter",
      categoryId: byName["Catheters"].id,
      brand: "CathLine",
      catalogueNumber: "JR-6F",
      purchasePrice: 1800,
      sellingPrice: 2800,
      minStock: 8,
    },
    {
      code: "ITM-0006",
      name: "Introducer Sheath 6F 11 cm",
      genericName: "Sheath",
      categoryId: byName["Sheaths"].id,
      brand: "AccessMed",
      catalogueNumber: "SH-6F-11",
      purchasePrice: 900,
      sellingPrice: 1500,
      minStock: 12,
    },
    {
      code: "ITM-0007",
      name: "Hydrophilic Guidewire 0.035\" 150 cm",
      genericName: "Guidewire",
      categoryId: byName["Guidewires"].id,
      brand: "GlidePath",
      catalogueNumber: "GW-035-150",
      purchasePrice: 2200,
      sellingPrice: 3200,
      minStock: 6,
    },
    {
      code: "ITM-0008",
      name: "Contrast Syringe 10 ml (sterile)",
      genericName: "Syringe",
      categoryId: byName["Medical consumables"].id,
      brand: "MediCons",
      catalogueNumber: "SYR-10",
      purchasePrice: 80,
      sellingPrice: 140,
      minStock: 50,
    },
  ];

  const createdProducts = [];
  for (const p of products) {
    createdProducts.push(
      await prisma.product.create({
        data: {
          ...p,
          unitId: piece.id,
          lastPurchasePrice: p.purchasePrice,
          averageCost: p.purchasePrice,
        },
      }),
    );
  }
  const stent = createdProducts[0];
  const balloon = createdProducts[2];
  const wire = createdProducts[3];

  // Historical purchases at different prices (FIFO demonstration)
  async function postPurchase(opts: {
    number: string;
    vendorId: string;
    date: Date;
    items: { productId: string; qty: number; price: number; batch?: string }[];
    paid: number;
    method: string;
  }) {
    const total = round2(opts.items.reduce((s, i) => s + i.qty * i.price, 0));
    const purchase = await prisma.purchase.create({
      data: {
        number: opts.number,
        vendorId: opts.vendorId,
        transactionDate: opts.date,
        createdById: admin.id,
        paymentMethod: opts.method,
        bankAccountId: cash?.id,
        total,
        subtotal: total,
        paidAmount: opts.paid,
        items: {
          create: opts.items.map((i) => ({
            productId: i.productId,
            quantity: i.qty,
            unitPrice: i.price,
            lineTotal: round2(i.qty * i.price),
            batchNumber: i.batch || "",
          })),
        },
      },
    });
    for (const i of opts.items) {
      await createLot(prisma, {
        productId: i.productId,
        sourceType: "PURCHASE",
        sourceId: purchase.id,
        receivedDate: opts.date,
        qty: i.qty,
        unitCost: i.price,
        batchNumber: i.batch,
        movementType: "PURCHASE",
        notes: purchase.number,
      });
    }
    const lines: { code: string; debit?: number; credit?: number; partyType?: string; partyId?: string; memo?: string }[] = [
      { code: ACCOUNTS.INVENTORY, debit: total, memo: purchase.number },
    ];
    if (opts.paid > 0) lines.push({ code: ACCOUNTS.CASH, credit: opts.paid, memo: purchase.number });
    if (total - opts.paid > 0) {
      lines.push({
        code: ACCOUNTS.AP,
        credit: round2(total - opts.paid),
        partyType: "VENDOR",
        partyId: opts.vendorId,
        memo: purchase.number,
      });
    }
    await postJournal(prisma, {
      transactionDate: opts.date,
      createdById: admin.id,
      sourceType: "PURCHASE",
      sourceId: purchase.id,
      purchaseId: purchase.id,
      memo: `Purchase ${purchase.number}`,
      lines,
    });
    return purchase;
  }

  await postPurchase({
    number: "PUR-00001",
    vendorId: vendorA.id,
    date: d(2023, 3, 15),
    items: [
      { productId: stent.id, qty: 10, price: 40000, batch: "ST-2023-A" },
      { productId: balloon.id, qty: 20, price: 10000, batch: "BL-2023-A" },
    ],
    paid: 600000,
    method: "cash",
  });
  await postPurchase({
    number: "PUR-00002",
    vendorId: vendorA.id,
    date: d(2024, 6, 10),
    items: [
      { productId: stent.id, qty: 8, price: 45000, batch: "ST-2024-B" },
      { productId: wire.id, qty: 30, price: 4000, batch: "WR-2024-A" },
    ],
    paid: 480000,
    method: "cash",
  });
  await postPurchase({
    number: "PUR-00003",
    vendorId: vendorB.id,
    date: d(2025, 2, 8),
    items: [
      { productId: stent.id, qty: 6, price: 52000, batch: "ST-2025-C" },
      { productId: balloon.id, qty: 15, price: 12000, batch: "BL-2025-B" },
      { productId: createdProducts[5].id, qty: 40, price: 900, batch: "SH-2025" },
    ],
    paid: 0,
    method: "credit",
  });

  async function postSale(opts: {
    number: string;
    customerId: string;
    date: Date;
    items: { productId: string; qty: number; price: number }[];
    paid: number;
  }) {
    const built = [];
    for (const it of opts.items) {
      const layers = await allocateCost(prisma, it.productId, it.qty);
      const costAmount = round2(layers.reduce((s, l) => s + l.amount, 0));
      const lineTotal = round2(it.qty * it.price);
      built.push({
        ...it,
        layers,
        costAmount,
        lineTotal,
        profitAmount: round2(lineTotal - costAmount),
      });
    }
    const total = round2(built.reduce((s, i) => s + i.lineTotal, 0));
    const totalCost = round2(built.reduce((s, i) => s + i.costAmount, 0));
    const grossProfit = round2(built.reduce((s, i) => s + i.profitAmount, 0));
    const sale = await prisma.sale.create({
      data: {
        number: opts.number,
        customerId: opts.customerId,
        transactionDate: opts.date,
        createdById: admin.id,
        paymentMethod: opts.paid >= total ? "cash" : "credit",
        total,
        subtotal: total,
        totalCost,
        grossProfit,
        paidAmount: opts.paid,
        paymentStatus: opts.paid >= total ? "PAID" : opts.paid > 0 ? "PARTIAL" : "UNPAID",
        shareToken: randomToken(28),
        items: {
          create: built.map((i) => ({
            productId: i.productId,
            quantity: i.qty,
            sellingPrice: i.price,
            lineTotal: i.lineTotal,
            costAmount: i.costAmount,
            profitAmount: i.profitAmount,
            allocations: {
              create: i.layers.map((l) => ({
                lotId: l.lotId,
                quantity: l.quantity,
                unitCost: l.unitCost,
                amount: l.amount,
              })),
            },
          })),
        },
      },
      include: { customer: true },
    });
    for (const i of built) {
      await consumeLayers(prisma, i.layers, {
        productId: i.productId,
        transactionDate: opts.date,
        movementType: "SALE",
        referenceType: "SALE",
        referenceId: sale.id,
        notes: sale.number,
      });
    }
    const lines: { code: string; debit?: number; credit?: number; partyType?: string; partyId?: string; memo?: string }[] = [];
    if (opts.paid > 0) lines.push({ code: ACCOUNTS.CASH, debit: opts.paid, memo: sale.number });
    if (total - opts.paid > 0) {
      lines.push({
        code: ACCOUNTS.AR,
        debit: round2(total - opts.paid),
        partyType: "CUSTOMER",
        partyId: opts.customerId,
        memo: sale.number,
      });
    }
    lines.push({ code: ACCOUNTS.SALES, credit: total, memo: sale.number });
    lines.push({ code: ACCOUNTS.COGS, debit: totalCost, memo: sale.number });
    lines.push({ code: ACCOUNTS.INVENTORY, credit: totalCost, memo: sale.number });
    await postJournal(prisma, {
      transactionDate: opts.date,
      createdById: admin.id,
      sourceType: "SALE",
      sourceId: sale.id,
      saleId: sale.id,
      memo: `Sale ${sale.number} — ${sale.customer.name}`,
      lines,
    });
    return sale;
  }

  // 2023 sale of stent purchased at 40,000 sold at 48,000 → profit 8,000 (FIFO)
  await postSale({
    number: "INV-00001",
    customerId: lihcc.id,
    date: d(2023, 4, 20),
    items: [{ productId: stent.id, qty: 2, price: 48000 }],
    paid: 96000,
  });
  await postSale({
    number: "INV-00002",
    customerId: lihcc.id,
    date: d(2024, 8, 12),
    items: [
      { productId: stent.id, qty: 3, price: 55000 },
      { productId: balloon.id, qty: 4, price: 14000 },
    ],
    paid: 100000,
  });
  const clinic = await prisma.customer.findUniqueOrThrow({ where: { code: "CUS-0002" } });
  await postSale({
    number: "INV-00003",
    customerId: clinic.id,
    date: d(2025, 11, 3),
    items: [
      { productId: balloon.id, qty: 2, price: 16000 },
      { productId: wire.id, qty: 5, price: 6500 },
    ],
    paid: 0,
  });

  // Consignment of 10 stents to LIHCC (from remaining 2023/2024 lots)
  const conLayers = await allocateCost(prisma, stent.id, 10);
  const conCost = round2(conLayers.reduce((s, l) => s + l.amount, 0) / 10);
  const consignment = await prisma.consignment.create({
    data: {
      number: "CON-00001",
      customerId: lihcc.id,
      transactionDate: d(2025, 6, 1),
      createdById: admin.id,
      notes: "Stents placed at Cath Lab on consignment.",
      status: "PARTIALLY_SETTLED",
      items: {
        create: [
          {
            productId: stent.id,
            qtySupplied: 10,
            qtyUsed: 6,
            qtyReturned: 2,
            qtyBilled: 0,
            costPrice: conCost,
            expectedSellingPrice: 62000,
            batchNumber: conLayers[0]?.batchNumber || "",
            status: "PARTIALLY_SETTLED",
          },
        ],
      },
    },
  });
  await consumeLayers(prisma, conLayers, {
    productId: stent.id,
    transactionDate: d(2025, 6, 1),
    movementType: "CONSIGNMENT_OUT",
    referenceType: "CONSIGNMENT",
    referenceId: consignment.id,
    notes: consignment.number,
    newLocation: "CONSIGNED",
  });
  const consignedValue = round2(conLayers.reduce((s, l) => s + l.amount, 0));
  await postJournal(prisma, {
    transactionDate: d(2025, 6, 1),
    createdById: admin.id,
    sourceType: "CONSIGNMENT",
    sourceId: consignment.id,
    memo: `Consignment ${consignment.number}`,
    lines: [
      { code: ACCOUNTS.INVENTORY_CONSIGNED, debit: consignedValue },
      { code: ACCOUNTS.INVENTORY, credit: consignedValue },
    ],
  });
  // Return 2 from consigned location back to on-hand
  const returnLayers = await allocateCost(prisma, stent.id, 2, undefined, "CONSIGNED");
  await consumeLayers(prisma, returnLayers, {
    productId: stent.id,
    transactionDate: d(2025, 7, 15),
    movementType: "CONSIGNMENT_RETURN",
    referenceType: "CONSIGNMENT",
    referenceId: consignment.id,
    notes: consignment.number,
    newLocation: "ON_HAND",
  });
  await postJournal(prisma, {
    transactionDate: d(2025, 7, 15),
    createdById: admin.id,
    sourceType: "CONSIGNMENT_RETURN",
    sourceId: consignment.id,
    memo: `Consignment return ${consignment.number}`,
    lines: [
      { code: ACCOUNTS.INVENTORY, debit: round2(2 * conCost) },
      { code: ACCOUNTS.INVENTORY_CONSIGNED, credit: round2(2 * conCost) },
    ],
  });

  await prisma.expense.create({
    data: {
      number: "EXP-00001",
      transactionDate: d(2025, 12, 5),
      createdById: admin.id,
      payee: "Courier",
      method: "cash",
      amount: 8500,
      notes: "Delivery of stents to LIHCC",
      category: { connect: { name: "Freight & Logistics" } },
    },
  });
  await postJournal(prisma, {
    transactionDate: d(2025, 12, 5),
    createdById: admin.id,
    sourceType: "EXPENSE",
    sourceId: "EXP-00001",
    memo: "Expense EXP-00001",
    lines: [
      { code: ACCOUNTS.EXPENSES, debit: 8500 },
      { code: ACCOUNTS.CASH, credit: 8500 },
    ],
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "SEED",
      entityType: "System",
      entityId: "default",
      entityLabel: "Initial historical records 2023–2025",
      newValue: JSON.stringify({ purchases: 3, sales: 3, consignments: 1 }),
    },
  });

  for (const [key, prefix, nextNumber] of [
    ["purchase", "PUR", "4"],
    ["sale", "INV", "4"],
    ["consignment", "CON", "2"],
    ["payment", "PAY", "1"],
    ["expense", "EXP", "2"],
    ["adjustment", "ADJ", "1"],
  ] as const) {
    await prisma.sequence.upsert({
      where: { key },
      update: { prefix, nextNumber: Number(nextNumber) },
      create: { key, prefix, nextNumber: Number(nextNumber) },
    });
  }

  console.log("Seeded LIHCC Enterprises with historical 2023–2025 records.");
  console.log("Login: admin / Admin@123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
