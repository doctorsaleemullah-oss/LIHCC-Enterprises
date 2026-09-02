import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtDate, toCsv } from "@/lib/format";
import { can } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !can(user.permissions, "reports", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const type = req.nextUrl.searchParams.get("type") || "sales";
  let csv = "";
  if (type === "sales" || type === "profit") {
    const sales = await prisma.sale.findMany({ where: { status: "POSTED" }, include: { customer: true } });
    csv = toCsv(
      ["Date", "Entered", "Invoice", "Customer", "Total", "Cost", "Profit", "Paid", "Status"],
      sales.map((s) => [fmtDate(s.transactionDate), fmtDate(s.enteredAt), s.number, s.customer.name, s.total, s.totalCost, s.grossProfit, s.paidAmount, s.paymentStatus]),
    );
  } else if (type === "purchases") {
    const rows = await prisma.purchase.findMany({ where: { status: "POSTED" }, include: { vendor: true } });
    csv = toCsv(
      ["Date", "Entered", "Bill", "Vendor", "Total", "Paid"],
      rows.map((s) => [fmtDate(s.transactionDate), fmtDate(s.enteredAt), s.number, s.vendor.name, s.total, s.paidAmount]),
    );
  } else if (type === "inventory") {
    const products = await prisma.product.findMany({ include: { lots: true, category: true } });
    csv = toCsv(
      ["Code", "Name", "Category", "OnHand", "Consigned", "AvgCost", "LastPurchase", "Selling", "Value"],
      products.map((p) => {
        const onHand = p.lots.filter((l) => l.location === "ON_HAND").reduce((s, l) => s + l.qtyRemaining, 0);
        const consigned = p.lots.filter((l) => l.location === "CONSIGNED").reduce((s, l) => s + l.qtyRemaining, 0);
        const value = p.lots.reduce((s, l) => s + l.qtyRemaining * l.unitCost, 0);
        return [p.code, p.name, p.category?.name, onHand, consigned, p.averageCost, p.lastPurchasePrice, p.sellingPrice, value];
      }),
    );
  } else if (type === "customers") {
    const rows = await prisma.customer.findMany();
    csv = toCsv(["Code", "Name", "Organization", "Phone", "Opening"], rows.map((c) => [c.code, c.name, c.organization, c.phone, c.openingBalance]));
  } else {
    const rows = await prisma.vendor.findMany();
    csv = toCsv(["Code", "Name", "Phone", "Opening"], rows.map((c) => [c.code, c.name, c.phone, c.openingBalance]));
  }
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lihcc-${type}.csv"`,
    },
  });
}
