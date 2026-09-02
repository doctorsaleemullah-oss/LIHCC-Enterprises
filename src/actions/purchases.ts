"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { audit, takeNextNumber } from "@/lib/audit";
import { parseDateInput, round2 } from "@/lib/format";
import { createLot } from "@/lib/inventory";
import { ACCOUNTS, cashOrBankCode, postJournal, type JournalLineInput } from "@/lib/accounting";

export async function createPurchase(formData: FormData) {
  const user = await requireAccess("purchases", "create");
  const vendorId = String(formData.get("vendorId") || "");
  const transactionDate = parseDateInput(String(formData.get("transactionDate") || ""));
  const paymentMethod = String(formData.get("paymentMethod") || "credit");
  const bankAccountId = String(formData.get("bankAccountId") || "") || null;
  const referenceNumber = String(formData.get("referenceNumber") || "");
  const notes = String(formData.get("notes") || "");
  const paidNow = round2(Number(formData.get("paidAmount") || 0));

  const productIds = formData.getAll("productId").map(String);
  const qtys = formData.getAll("quantity").map(Number);
  const prices = formData.getAll("unitPrice").map(Number);
  const discounts = formData.getAll("discount").map(Number);
  const taxes = formData.getAll("taxRate").map(Number);
  const batches = formData.getAll("batchNumber").map(String);
  const serials = formData.getAll("serialNumber").map(String);
  const expiries = formData.getAll("expiryDate").map(String);

  const items = productIds
    .map((productId, i) => {
      const quantity = Number(qtys[i] || 0);
      const unitPrice = Number(prices[i] || 0);
      const discount = Number(discounts[i] || 0);
      const taxRate = Number(taxes[i] || 0);
      if (!productId || quantity <= 0) return null;
      const taxable = round2(quantity * unitPrice - discount);
      const taxAmount = round2(taxable * (taxRate / 100));
      return {
        productId,
        quantity,
        unitPrice,
        discount,
        taxRate,
        taxAmount,
        lineTotal: round2(taxable + taxAmount),
        batchNumber: batches[i] || "",
        serialNumber: serials[i] || "",
        expiryDate: expiries[i] ? parseDateInput(expiries[i]) : null,
      };
    })
    .filter(Boolean) as {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
    taxAmount: number;
    lineTotal: number;
    batchNumber: string;
    serialNumber: string;
    expiryDate: Date | null;
  }[];

  if (!vendorId) return { error: "Select a vendor." };
  if (!items.length) return { error: "Add at least one purchase item." };

  const subtotal = round2(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0));
  const discountAmount = round2(items.reduce((s, it) => s + it.discount, 0));
  const taxAmount = round2(items.reduce((s, it) => s + it.taxAmount, 0));
  const total = round2(items.reduce((s, it) => s + it.lineTotal, 0));
  const paidAmount = paymentMethod === "credit" ? Math.min(paidNow, total) : Math.min(paidNow || total, total);

  const company = await prisma.company.findUnique({ where: { id: "default" } });
  const number = await takeNextNumber("purchase", company?.purchasePrefix || "PUR");

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        number,
        vendorId,
        transactionDate,
        createdById: user.id,
        paymentMethod,
        bankAccountId,
        referenceNumber,
        notes,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        paidAmount,
        items: { create: items },
      },
      include: { items: true, vendor: true },
    });

    for (const item of created.items) {
      const unitCost = round2(item.lineTotal / item.quantity);
      await createLot(tx, {
        productId: item.productId,
        sourceType: "PURCHASE",
        sourceId: created.id,
        receivedDate: transactionDate,
        qty: item.quantity,
        unitCost,
        batchNumber: item.batchNumber,
        serialNumber: item.serialNumber,
        expiryDate: item.expiryDate,
        movementType: "PURCHASE",
        notes: created.number,
      });
    }

    const cashCode = await cashOrBankCode(tx, bankAccountId, paymentMethod);
    const lines: JournalLineInput[] = [
      { code: ACCOUNTS.INVENTORY, debit: total, memo: created.number },
    ];
    if (paidAmount > 0 && cashCode) {
      lines.push({
        code: cashCode,
        credit: paidAmount,
        memo: `${created.number} payment`,
      });
    }
    const payable = round2(total - paidAmount);
    if (payable > 0) {
      lines.push({
        code: ACCOUNTS.AP,
        credit: payable,
        partyType: "VENDOR",
        partyId: vendorId,
        memo: created.number,
      });
    }
    await postJournal(tx, {
      transactionDate,
      createdById: user.id,
      sourceType: "PURCHASE",
      sourceId: created.id,
      purchaseId: created.id,
      memo: `Purchase ${created.number} — ${created.vendor.name}`,
      lines,
    });

    return created;
  });

  await audit({
    user,
    action: "CREATE",
    entityType: "Purchase",
    entityId: purchase.id,
    entityLabel: purchase.number,
    newValue: { number: purchase.number, vendorId, total, transactionDate },
  });
  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true, id: purchase.id, number: purchase.number };
}
