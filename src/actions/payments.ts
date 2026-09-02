"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { audit, takeNextNumber } from "@/lib/audit";
import { parseDateInput, round2 } from "@/lib/format";
import { ACCOUNTS, cashOrBankCode, postJournal, type JournalLineInput } from "@/lib/accounting";

export async function createPayment(formData: FormData) {
  const user = await requireAccess("payments", "create");
  const direction = String(formData.get("direction") || "IN");
  const partyType = String(formData.get("partyType") || "CUSTOMER");
  const customerId = String(formData.get("customerId") || "") || null;
  const vendorId = String(formData.get("vendorId") || "") || null;
  const transactionDate = parseDateInput(String(formData.get("transactionDate") || ""));
  const method = String(formData.get("method") || "cash");
  const bankAccountId = String(formData.get("bankAccountId") || "") || null;
  const referenceNumber = String(formData.get("referenceNumber") || "");
  const notes = String(formData.get("notes") || "");
  const amount = round2(Number(formData.get("amount") || 0));
  const saleId = String(formData.get("saleId") || "") || null;
  const purchaseId = String(formData.get("purchaseId") || "") || null;

  if (amount <= 0) return { error: "Enter a payment amount." };
  if (partyType === "CUSTOMER" && !customerId) return { error: "Select a customer." };
  if (partyType === "VENDOR" && !vendorId) return { error: "Select a vendor." };

  const company = await prisma.company.findUnique({ where: { id: "default" } });
  const number = await takeNextNumber("payment", company?.paymentPrefix || "PAY");

  const payment = await prisma.$transaction(async (tx) => {
    let unallocated = amount;
    const allocations: { saleId?: string; purchaseId?: string; amount: number }[] = [];

    if (direction === "IN" && customerId) {
      if (saleId) {
        const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId } });
        const due = round2(sale.total - sale.paidAmount);
        const apply = Math.min(due, unallocated);
        if (apply > 0) {
          allocations.push({ saleId, amount: apply });
          unallocated = round2(unallocated - apply);
          const paidAmount = round2(sale.paidAmount + apply);
          const paymentStatus = paidAmount + 0.01 >= sale.total ? "PAID" : "PARTIAL";
          await tx.sale.update({
            where: { id: sale.id },
            data: { paidAmount, paymentStatus, paidAt: paymentStatus === "PAID" ? transactionDate : sale.paidAt },
          });
        }
      } else {
        const invoices = await tx.sale.findMany({
          where: { customerId, status: "POSTED", paymentStatus: { in: ["UNPAID", "PARTIAL"] } },
          orderBy: { transactionDate: "asc" },
        });
        for (const sale of invoices) {
          if (unallocated <= 0) break;
          const due = round2(sale.total - sale.paidAmount);
          const apply = Math.min(due, unallocated);
          if (apply <= 0) continue;
          allocations.push({ saleId: sale.id, amount: apply });
          unallocated = round2(unallocated - apply);
          const paidAmount = round2(sale.paidAmount + apply);
          const paymentStatus = paidAmount + 0.01 >= sale.total ? "PAID" : "PARTIAL";
          await tx.sale.update({
            where: { id: sale.id },
            data: { paidAmount, paymentStatus, paidAt: paymentStatus === "PAID" ? transactionDate : sale.paidAt },
          });
        }
      }
    }

    if (direction === "OUT" && vendorId) {
      if (purchaseId) {
        const purchase = await tx.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
        const due = round2(purchase.total - purchase.paidAmount);
        const apply = Math.min(due, unallocated);
        if (apply > 0) {
          allocations.push({ purchaseId, amount: apply });
          unallocated = round2(unallocated - apply);
          await tx.purchase.update({
            where: { id: purchase.id },
            data: { paidAmount: round2(purchase.paidAmount + apply) },
          });
        }
      } else {
        const bills = await tx.purchase.findMany({
          where: { vendorId, status: "POSTED" },
          orderBy: { transactionDate: "asc" },
        });
        for (const purchase of bills) {
          if (unallocated <= 0) break;
          const due = round2(purchase.total - purchase.paidAmount);
          if (due <= 0) continue;
          const apply = Math.min(due, unallocated);
          allocations.push({ purchaseId: purchase.id, amount: apply });
          unallocated = round2(unallocated - apply);
          await tx.purchase.update({
            where: { id: purchase.id },
            data: { paidAmount: round2(purchase.paidAmount + apply) },
          });
        }
      }
    }

    const created = await tx.payment.create({
      data: {
        number,
        direction,
        partyType,
        customerId,
        vendorId,
        transactionDate,
        createdById: user.id,
        method,
        bankAccountId,
        referenceNumber,
        amount,
        unallocated,
        notes,
        allocations: { create: allocations },
      },
    });

    const cashCode = (await cashOrBankCode(tx, bankAccountId, method)) || ACCOUNTS.CASH;
    const lines: JournalLineInput[] =
      direction === "IN"
        ? [
            { code: cashCode, debit: amount, memo: created.number },
            {
              code: ACCOUNTS.AR,
              credit: amount,
              partyType: "CUSTOMER",
              partyId: customerId || "",
              memo: created.number,
            },
          ]
        : [
            {
              code: ACCOUNTS.AP,
              debit: amount,
              partyType: "VENDOR",
              partyId: vendorId || "",
              memo: created.number,
            },
            { code: cashCode, credit: amount, memo: created.number },
          ];

    await postJournal(tx, {
      transactionDate,
      createdById: user.id,
      sourceType: "PAYMENT",
      sourceId: created.id,
      paymentId: created.id,
      memo: `Payment ${created.number}`,
      lines,
    });
    return created;
  });

  await audit({
    user,
    action: "CREATE",
    entityType: "Payment",
    entityId: payment.id,
    entityLabel: payment.number,
    newValue: { direction, amount, customerId, vendorId, transactionDate },
  });
  revalidatePath("/payments");
  revalidatePath("/sales");
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  return { ok: true, id: payment.id };
}

export async function createExpense(formData: FormData) {
  const user = await requireAccess("expenses", "create");
  const amount = round2(Number(formData.get("amount") || 0));
  if (amount <= 0) return { error: "Enter an expense amount." };
  const transactionDate = parseDateInput(String(formData.get("transactionDate") || ""));
  const method = String(formData.get("method") || "cash");
  const bankAccountId = String(formData.get("bankAccountId") || "") || null;
  const company = await prisma.company.findUnique({ where: { id: "default" } });
  const number = await takeNextNumber("expense", company?.expensePrefix || "EXP");

  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        number,
        categoryId: String(formData.get("categoryId") || "") || null,
        transactionDate,
        createdById: user.id,
        payee: String(formData.get("payee") || ""),
        method,
        bankAccountId,
        amount,
        notes: String(formData.get("notes") || ""),
      },
    });
    const cashCode = (await cashOrBankCode(tx, bankAccountId, method)) || ACCOUNTS.CASH;
    await postJournal(tx, {
      transactionDate,
      createdById: user.id,
      sourceType: "EXPENSE",
      sourceId: created.id,
      expenseId: created.id,
      memo: `Expense ${created.number}`,
      lines: [
        { code: ACCOUNTS.EXPENSES, debit: amount, memo: created.number },
        { code: cashCode, credit: amount, memo: created.number },
      ],
    });
    return created;
  });

  await audit({
    user,
    action: "CREATE",
    entityType: "Expense",
    entityId: expense.id,
    entityLabel: expense.number,
    newValue: { amount, transactionDate },
  });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true, id: expense.id };
}
