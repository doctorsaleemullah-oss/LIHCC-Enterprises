import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function audit(params: {
  user?: SessionUser | null;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.user?.id ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityLabel: params.entityLabel ?? "",
      previousValue: params.previousValue ? JSON.stringify(params.previousValue) : "",
      newValue: params.newValue ? JSON.stringify(params.newValue) : "",
    },
  });
}

export async function nextNumber(key: string, prefix: string): Promise<string> {
  return takeNextNumber(key, prefix);
}

export async function takeNextNumber(key: string, prefix: string, db: Db = prisma): Promise<string> {
  const result = await db.sequence.upsert({
    where: { key },
    update: { nextNumber: { increment: 1 }, prefix },
    create: { key, prefix, nextNumber: 2 },
  });
  return `${prefix}-${String(result.nextNumber - 1).padStart(5, "0")}`;
}

export function randomToken(len = 24): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
