"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { restoreLayers } from "@/lib/inventory";
import { voidJournal } from "@/lib/accounting";

export async function voidSale(id: string) {
  const user = await requireAccess("sales", "void");
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { items: { include: { allocations: true } } },
  });
  if (!sale || sale.status === "VOIDED") return { error: "Sale not found or already voided." };

  await prisma.$transaction(async (tx) => {
    for (const item of sale.items) {
      await restoreLayers(
        tx,
        item.allocations.map((a) => ({ lotId: a.lotId, quantity: a.quantity, unitCost: a.unitCost })),
        {
          productId: item.productId,
          transactionDate: new Date(),
          movementType: "SALE_RETURN",
          referenceType: "SALE_VOID",
          referenceId: sale.id,
        },
      );
    }
    await tx.sale.update({ where: { id }, data: { status: "VOIDED", paymentStatus: "UNPAID" } });
    await voidJournal(tx, "SALE", id, user.id);
  });
  await audit({
    user,
    action: "VOID",
    entityType: "Sale",
    entityId: id,
    entityLabel: sale.number,
    previousValue: { status: sale.status, total: sale.total },
    newValue: { status: "VOIDED" },
  });
  revalidatePath("/sales");
  revalidatePath("/products");
  return { ok: true };
}

export async function voidPurchase(id: string) {
  const user = await requireAccess("purchases", "void");
  const purchase = await prisma.purchase.findUnique({ where: { id }, include: { items: true } });
  if (!purchase || purchase.status === "VOIDED") return { error: "Purchase not found or already voided." };

  await prisma.$transaction(async (tx) => {
    const lots = await tx.inventoryLot.findMany({
      where: { sourceType: "PURCHASE", sourceId: id },
    });
    for (const lot of lots) {
      if (lot.qtyRemaining + 0.0001 < lot.qtyReceived) {
        throw new Error(
          `Cannot void ${purchase.number}: stock from this purchase has already been sold or consigned. Record a purchase return instead.`,
        );
      }
      await tx.inventoryLot.update({ where: { id: lot.id }, data: { qtyRemaining: 0 } });
      await tx.stockMovement.create({
        data: {
          productId: lot.productId,
          lotId: lot.id,
          type: "PURCHASE_RETURN",
          qty: -lot.qtyReceived,
          unitCost: lot.unitCost,
          transactionDate: new Date(),
          referenceType: "PURCHASE_VOID",
          referenceId: id,
          notes: `Void ${purchase.number}`,
        },
      });
    }
    await tx.purchase.update({ where: { id }, data: { status: "VOIDED" } });
    await voidJournal(tx, "PURCHASE", id, user.id);
  });
  await audit({
    user,
    action: "VOID",
    entityType: "Purchase",
    entityId: id,
    entityLabel: purchase.number,
    previousValue: { status: purchase.status, total: purchase.total },
    newValue: { status: "VOIDED" },
  });
  revalidatePath("/purchases");
  revalidatePath("/products");
  return { ok: true };
}

export async function voidPayment(id: string) {
  const user = await requireAccess("payments", "void");
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { allocations: true },
  });
  if (!payment || payment.status === "VOIDED") return { error: "Payment not found or already voided." };

  await prisma.$transaction(async (tx) => {
    for (const a of payment.allocations) {
      if (a.saleId) {
        const sale = await tx.sale.findUniqueOrThrow({ where: { id: a.saleId } });
        const paidAmount = Math.max(0, sale.paidAmount - a.amount);
        const paymentStatus = paidAmount <= 0 ? "UNPAID" : paidAmount + 0.01 >= sale.total ? "PAID" : "PARTIAL";
        await tx.sale.update({ where: { id: sale.id }, data: { paidAmount, paymentStatus } });
      }
      if (a.purchaseId) {
        const purchase = await tx.purchase.findUniqueOrThrow({ where: { id: a.purchaseId } });
        await tx.purchase.update({
          where: { id: purchase.id },
          data: { paidAmount: Math.max(0, purchase.paidAmount - a.amount) },
        });
      }
    }
    await tx.payment.update({ where: { id }, data: { status: "VOIDED" } });
    await voidJournal(tx, "PAYMENT", id, user.id);
  });
  await audit({
    user,
    action: "VOID",
    entityType: "Payment",
    entityId: id,
    entityLabel: payment.number,
    previousValue: { amount: payment.amount },
    newValue: { status: "VOIDED" },
  });
  revalidatePath("/payments");
  return { ok: true };
}
