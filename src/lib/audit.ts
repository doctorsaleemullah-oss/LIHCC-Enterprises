import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

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
  const row = await prisma.sequence.upsert({
    where: { key },
    update: { nextNumber: { increment: 1 }, prefix },
    create: { key, prefix, nextNumber: 2 },
  });
  const n = row.nextNumber === 2 && row.prefix === prefix ? 1 : row.nextNumber - 1;
  // upsert increment happens after create with nextNumber 2, so first call yields 1 via create path.
  const seq = await prisma.sequence.findUniqueOrThrow({ where: { key } });
  const num = Math.max(1, seq.nextNumber - 1);
  return `${prefix}-${String(n || num).padStart(5, "0")}`;
}

export async function takeNextNumber(key: string, prefix: string): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.sequence.findUnique({ where: { key } });
    if (!existing) {
      await tx.sequence.create({ data: { key, prefix, nextNumber: 2 } });
      return 1;
    }
    const current = existing.nextNumber;
    await tx.sequence.update({
      where: { key },
      data: { nextNumber: current + 1, prefix },
    });
    return current;
  });
  return `${prefix}-${String(result).padStart(5, "0")}`;
}

export function randomToken(len = 24): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
