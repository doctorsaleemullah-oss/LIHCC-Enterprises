"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { audit, takeNextNumber, randomToken } from "@/lib/audit";
import { parseDateInput, round2 } from "@/lib/format";
import { allocateCost, consumeLayers } from "@/lib/inventory";
import { ACCOUNTS, cashOrBankCode, postJournal } from "@/lib/accounting";

export async function createSale(formData: FormData) {
  const user = await requireAccess("sales", "create");
  const customerId = String(formData.get("customerId") || "");
  const transactionDate = parseDateInput(String(formData.get("transactionDate") || ""));
  const paymentMethod = String(formData.get("paymentMethod") || "credit");
  const bankAccountId = String(formData.get("bankAccountId") || "") || null;
  const referenceNumber = String(formData.get("referenceNumber") || "");
  const notes = String(formData.get("notes") || "");
  const paidNow = round2(Number(formData.get("paidAmount") || 0));
  const consignmentId = String(formData.get("consignmentId") || "") || null;

  const productIds = formData.getAll("productId").map(String);
  const qtys = formData.getAll("quantity").map(Number);
  const prices = formData.getAll("sellingPrice").map(Number);
  const discounts = formData.getAll("discount").map(Number);
  const taxes = formData.getAll("taxRate").map(Number);

  if (!customerId) return { error: "Select a customer." };

  const company = await prisma.company.findUnique({ where: { id: "default" } });
  const number = await takeNextNumber("sale", company?.invoicePrefix || "INV");
  const shareToken = randomToken(28);

  try {
    const sale = await prisma.$transaction(async (tx) => {
      type BuiltItem = {
        productId: string;
        quantity: number;
        sellingPrice: number;
        discount: number;
        taxRate: number;
        taxAmount: number;
        lineTotal: number;
        costAmount: number;
        profitAmount: number;
        layers: Awaited<ReturnType<typeof allocateCost>>;
      };
      const built: BuiltItem[] = [];

      for (let i = 0; i < productIds.length; i++) {
        const productId = productIds[i];
        const quantity = Number(qtys[i] || 0);
        const sellingPrice = Number(prices[i] || 0);
        const discount = Number(discounts[i] || 0);
        const taxRate = Number(taxes[i] || 0);
        if (!productId || quantity <= 0) continue;
        const taxable = round2(quantity * sellingPrice - discount);
        const taxAmount = round2(taxable * (taxRate / 100));
        const lineTotal = round2(taxable + taxAmount);
        const layers = await allocateCost(tx, productId, quantity, undefined, consignmentId ? "CONSIGNED" : "ON_HAND");
        const costAmount = round2(layers.reduce((s, l) => s + l.amount, 0));
        built.push({
          productId,
          quantity,
          sellingPrice,
          discount,
          taxRate,
          taxAmount,
          lineTotal,
          costAmount,
          profitAmount: round2(taxable - costAmount),
          layers,
        });
      }
      if (!built.length) throw new Error("Add at least one sale item.");

      const subtotal = round2(built.reduce((s, it) => s + it.quantity * it.sellingPrice, 0));
      const discountAmount = round2(built.reduce((s, it) => s + it.discount, 0));
      const taxAmount = round2(built.reduce((s, it) => s + it.taxAmount, 0));
      const total = round2(built.reduce((s, it) => s + it.lineTotal, 0));
      const totalCost = round2(built.reduce((s, it) => s + it.costAmount, 0));
      const grossProfit = round2(built.reduce((s, it) => s + it.profitAmount, 0));
      const paidAmount =
        paymentMethod === "credit" ? Math.min(paidNow, total) : Math.min(paidNow || total, total);
      const paymentStatus = paidAmount <= 0 ? "UNPAID" : paidAmount + 0.01 >= total ? "PAID" : "PARTIAL";

      const created = await tx.sale.create({
        data: {
          number,
          customerId,
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
          totalCost,
          grossProfit,
          paidAmount,
          paymentStatus,
          shareToken,
          consignmentId,
          paidAt: paymentStatus === "PAID" ? transactionDate : null,
          items: {
            create: built.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              sellingPrice: it.sellingPrice,
              discount: it.discount,
              taxRate: it.taxRate,
              taxAmount: it.taxAmount,
              lineTotal: it.lineTotal,
              costAmount: it.costAmount,
              profitAmount: it.profitAmount,
              allocations: {
                create: it.layers.map((l) => ({
                  lotId: l.lotId,
                  quantity: l.quantity,
                  unitCost: l.unitCost,
                  amount: l.amount,
                })),
              },
            })),
          },
        },
        include: { items: { include: { allocations: true } }, customer: true },
      });

      for (const it of built) {
        await consumeLayers(tx, it.layers, {
          productId: it.productId,
          transactionDate,
          movementType: "SALE",
          referenceType: "SALE",
          referenceId: created.id,
          notes: created.number,
        });
      }

      const cashCode = await cashOrBankCode(tx, bankAccountId, paymentMethod);
      const revenue = round2(subtotal - discountAmount);
      const lines: { code: string; debit?: number; credit?: number; partyType?: string; partyId?: string; memo?: string }[] = [];
      if (paidAmount > 0 && cashCode) {
        lines.push({ code: cashCode, debit: paidAmount, memo: created.number });
      }
      const receivable = round2(total - paidAmount);
      if (receivable > 0) {
        lines.push({
          code: ACCOUNTS.AR,
          debit: receivable,
          partyType: "CUSTOMER",
          partyId: customerId,
          memo: created.number,
        });
      }
      lines.push({ code: ACCOUNTS.SALES, credit: revenue, memo: created.number });
      if (taxAmount > 0) lines.push({ code: ACCOUNTS.TAX_PAYABLE, credit: taxAmount, memo: created.number });
      if (discountAmount > 0) lines.push({ code: ACCOUNTS.DISCOUNT_GIVEN, debit: discountAmount, memo: created.number });
      if (totalCost > 0) {
        lines.push({ code: ACCOUNTS.COGS, debit: totalCost, memo: created.number });
        lines.push({
          code: consignmentId ? ACCOUNTS.INVENTORY_CONSIGNED : ACCOUNTS.INVENTORY,
          credit: totalCost,
          memo: created.number,
        });
      }

      await postJournal(tx, {
        transactionDate,
        createdById: user.id,
        sourceType: "SALE",
        sourceId: created.id,
        saleId: created.id,
        memo: `Sale ${created.number} — ${created.customer.name}`,
        lines,
      });

      return created;
    });

    await audit({
      user,
      action: "CREATE",
      entityType: "Sale",
      entityId: sale.id,
      entityLabel: sale.number,
      newValue: {
        number: sale.number,
        customerId,
        total: sale.total,
        cost: sale.totalCost,
        profit: sale.grossProfit,
        transactionDate,
      },
    });
    revalidatePath("/sales");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    revalidatePath("/invoices");
    return { ok: true, id: sale.id, number: sale.number };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save sale." };
  }
}

export async function markInvoiceViewed(token: string) {
  const sale = await prisma.sale.findUnique({ where: { shareToken: token } });
  if (!sale) return;
  if (!sale.viewedAt) {
    await prisma.sale.update({ where: { id: sale.id }, data: { viewedAt: new Date() } });
  }
}
