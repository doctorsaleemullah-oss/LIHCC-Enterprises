import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { takeNextNumber } from "./audit";
import { round2 } from "./format";

type Db = PrismaClient | Prisma.TransactionClient;

export const ACCOUNTS = {
  CASH: "1000",
  BANK: "1010",
  AR: "1100",
  INVENTORY: "1200",
  INVENTORY_CONSIGNED: "1210",
  AP: "2000",
  TAX_PAYABLE: "2100",
  OPENING_EQUITY: "3000",
  RETAINED: "3100",
  SALES: "4000",
  SALES_RETURNS: "4100",
  DISCOUNT_GIVEN: "4200",
  COGS: "5000",
  PURCHASE_RETURNS: "5100",
  DISCOUNT_RECEIVED: "5200",
  EXPENSES: "6000",
} as const;

export async function accountByCode(db: Db, code: string) {
  const acc = await db.glAccount.findUnique({ where: { code } });
  if (!acc) throw new Error(`Missing GL account ${code}`);
  return acc;
}

export type JournalLineInput = {
  code: string;
  debit?: number;
  credit?: number;
  partyType?: string;
  partyId?: string;
  memo?: string;
};

export async function postJournal(
  db: Db,
  params: {
    transactionDate: Date;
    createdById: string;
    sourceType: string;
    sourceId: string;
    memo: string;
    lines: JournalLineInput[];
    saleId?: string;
    purchaseId?: string;
    paymentId?: string;
    expenseId?: string;
  },
) {
  const cleaned = params.lines
    .map((l) => ({
      ...l,
      debit: round2(l.debit || 0),
      credit: round2(l.credit || 0),
    }))
    .filter((l) => l.debit !== 0 || l.credit !== 0);

  const debit = round2(cleaned.reduce((s, l) => s + l.debit, 0));
  const credit = round2(cleaned.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(debit - credit) > 0.05) {
    throw new Error(`Unbalanced journal (${debit} Dr / ${credit} Cr): ${params.memo}`);
  }

  const number = await takeNextNumber("journal", "JV");
  const created = await db.journalEntry.create({
    data: {
      number,
      transactionDate: params.transactionDate,
      createdById: params.createdById,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      memo: params.memo,
      saleId: params.saleId,
      purchaseId: params.purchaseId,
      paymentId: params.paymentId,
      expenseId: params.expenseId,
      lines: {
        create: await Promise.all(
          cleaned.map(async (l) => {
            const acc = await accountByCode(db, l.code);
            return {
              accountId: acc.id,
              debit: l.debit,
              credit: l.credit,
              partyType: l.partyType ?? "",
              partyId: l.partyId ?? "",
              memo: l.memo ?? "",
            };
          }),
        ),
      },
    },
    include: { lines: true },
  });
  return created;
}

export async function voidJournal(db: Db, sourceType: string, sourceId: string, createdById: string) {
  const entries = await db.journalEntry.findMany({
    where: { sourceType, sourceId, isVoided: false },
    include: { lines: { include: { account: true } } },
  });
  for (const entry of entries) {
    await db.journalEntry.update({ where: { id: entry.id }, data: { isVoided: true } });
    const reversing = entry.lines.map((l) => ({
      code: l.account.code,
      debit: l.credit,
      credit: l.debit,
      partyType: l.partyType,
      partyId: l.partyId,
      memo: `Reversal of ${entry.number}`,
    }));
    await postJournal(db, {
      transactionDate: new Date(),
      createdById,
      sourceType,
      sourceId,
      memo: `Void reversal of ${entry.number}`,
      lines: reversing,
    });
  }
}

export async function cashOrBankCode(db: Db, bankAccountId?: string | null, method?: string) {
  if (method === "credit") return null;
  if (!bankAccountId) return method === "bank" || method === "online" || method === "cheque" ? ACCOUNTS.BANK : ACCOUNTS.CASH;
  const ba = await db.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!ba) return ACCOUNTS.CASH;
  return ba.isCash ? ACCOUNTS.CASH : ACCOUNTS.BANK;
}

export async function accountBalance(code: string, asOf?: Date) {
  const acc = await prisma.glAccount.findUnique({ where: { code } });
  if (!acc) return 0;
  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: acc.id,
      journal: {
        isVoided: false,
        ...(asOf ? { transactionDate: { lte: asOf } } : {}),
      },
    },
  });
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  if (acc.type === "ASSET" || acc.type === "EXPENSE") return round2(debit - credit);
  return round2(credit - debit);
}

export async function partyLedger(partyType: "CUSTOMER" | "VENDOR", partyId: string) {
  const arOrAp = partyType === "CUSTOMER" ? ACCOUNTS.AR : ACCOUNTS.AP;
  const acc = await prisma.glAccount.findUnique({ where: { code: arOrAp } });
  if (!acc) return [];
  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: acc.id,
      partyType,
      partyId,
      journal: { isVoided: false },
    },
    include: { journal: true },
    orderBy: [{ journal: { transactionDate: "asc" } }, { journal: { enteredAt: "asc" } }],
  });
  let running = 0;
  return lines.map((l) => {
    if (partyType === "CUSTOMER") running = round2(running + l.debit - l.credit);
    else running = round2(running + l.credit - l.debit);
    return { ...l, running };
  });
}

export async function customerOutstanding(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return 0;
  const sales = await prisma.sale.aggregate({
    where: { customerId, status: "POSTED" },
    _sum: { total: true, paidAmount: true },
  });
  const returns = await prisma.saleReturn.aggregate({
    where: { customerId, status: "POSTED" },
    _sum: { total: true },
  });
  return round2(
    (customer.openingBalance || 0) +
      (sales._sum.total || 0) -
      (sales._sum.paidAmount || 0) -
      (returns._sum.total || 0),
  );
}

export async function vendorOutstanding(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return 0;
  const purchases = await prisma.purchase.aggregate({
    where: { vendorId, status: "POSTED" },
    _sum: { total: true, paidAmount: true },
  });
  const returns = await prisma.purchaseReturn.aggregate({
    where: { vendorId, status: "POSTED" },
    _sum: { total: true },
  });
  return round2(
    (vendor.openingBalance || 0) +
      (purchases._sum.total || 0) -
      (purchases._sum.paidAmount || 0) -
      (returns._sum.total || 0),
  );
}
