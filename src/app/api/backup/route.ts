import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !can(user.permissions, "settings", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const data = {
    exportedAt: new Date().toISOString(),
    company: await prisma.company.findMany(),
    users: await prisma.user.findMany({ select: { id: true, username: true, name: true, email: true, roleId: true, isActive: true } }),
    roles: await prisma.role.findMany(),
    customers: await prisma.customer.findMany(),
    vendors: await prisma.vendor.findMany(),
    products: await prisma.product.findMany(),
    purchases: await prisma.purchase.findMany({ include: { items: true } }),
    sales: await prisma.sale.findMany({ include: { items: { include: { allocations: true } } } }),
    consignments: await prisma.consignment.findMany({ include: { items: true } }),
    payments: await prisma.payment.findMany({ include: { allocations: true } }),
    expenses: await prisma.expense.findMany(),
    journals: await prisma.journalEntry.findMany({ include: { lines: true } }),
    lots: await prisma.inventoryLot.findMany(),
    movements: await prisma.stockMovement.findMany(),
    audit: await prisma.auditLog.findMany({ take: 5000 }),
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lihcc-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
