import type { InventoryLot, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { round2 } from "./format";

type Db = PrismaClient | Prisma.TransactionClient;

export type CostLayer = {
  lotId: string;
  quantity: number;
  unitCost: number;
  amount: number;
  batchNumber: string;
  serialNumber: string;
};

export async function getCostingMethod(db: Db = prisma): Promise<"FIFO" | "WEIGHTED_AVERAGE"> {
  const company = await db.company.findUnique({ where: { id: "default" } });
  return company?.costingMethod === "WEIGHTED_AVERAGE" ? "WEIGHTED_AVERAGE" : "FIFO";
}

export async function lotsAt(db: Db, productId: string, location = "ON_HAND"): Promise<InventoryLot[]> {
  return db.inventoryLot.findMany({
    where: { productId, location, qtyRemaining: { gt: 0 } },
    orderBy: [{ receivedDate: "asc" }, { createdAt: "asc" }],
  });
}

export async function onHandLots(db: Db, productId: string): Promise<InventoryLot[]> {
  return lotsAt(db, productId, "ON_HAND");
}

export async function productStock(db: Db, productId: string) {
  const lots = await db.inventoryLot.findMany({ where: { productId } });
  const onHand = lots.filter((l) => l.location === "ON_HAND").reduce((s, l) => s + l.qtyRemaining, 0);
  const consigned = lots.filter((l) => l.location === "CONSIGNED").reduce((s, l) => s + l.qtyRemaining, 0);
  const value = lots
    .filter((l) => l.location === "ON_HAND" || l.location === "CONSIGNED")
    .reduce((s, l) => s + l.qtyRemaining * l.unitCost, 0);
  return { onHand, consigned, value: round2(value) };
}

export async function refreshAverageCost(db: Db, productId: string) {
  const lots = await db.inventoryLot.findMany({
    where: { productId, qtyRemaining: { gt: 0 } },
  });
  const qty = lots.reduce((s, l) => s + l.qtyRemaining, 0);
  const value = lots.reduce((s, l) => s + l.qtyRemaining * l.unitCost, 0);
  const averageCost = qty > 0 ? round2(value / qty) : 0;
  await db.product.update({ where: { id: productId }, data: { averageCost } });
  return averageCost;
}

export async function createLot(
  db: Db,
  params: {
    productId: string;
    sourceType: string;
    sourceId: string;
    receivedDate: Date;
    qty: number;
    unitCost: number;
    batchNumber?: string;
    serialNumber?: string;
    expiryDate?: Date | null;
    location?: string;
    movementType?: string;
    notes?: string;
  },
) {
  const lot = await db.inventoryLot.create({
    data: {
      productId: params.productId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      receivedDate: params.receivedDate,
      qtyReceived: params.qty,
      qtyRemaining: params.qty,
      unitCost: params.unitCost,
      batchNumber: params.batchNumber ?? "",
      serialNumber: params.serialNumber ?? "",
      expiryDate: params.expiryDate ?? null,
      location: params.location ?? "ON_HAND",
    },
  });
  await db.stockMovement.create({
    data: {
      productId: params.productId,
      lotId: lot.id,
      type: params.movementType ?? params.sourceType,
      qty: params.qty,
      unitCost: params.unitCost,
      transactionDate: params.receivedDate,
      referenceType: params.sourceType,
      referenceId: params.sourceId,
      notes: params.notes ?? "",
    },
  });
  const last = await db.product.findUnique({ where: { id: params.productId } });
  await db.product.update({
    where: { id: params.productId },
    data: {
      lastPurchasePrice:
        params.sourceType === "PURCHASE" ? params.unitCost : last?.lastPurchasePrice ?? params.unitCost,
      purchasePrice:
        params.sourceType === "PURCHASE" ? params.unitCost : last?.purchasePrice ?? params.unitCost,
    },
  });
  await refreshAverageCost(db, params.productId);
  return lot;
}

/**
 * Allocate actual historical lot costs for a quantity leaving on-hand stock.
 * FIFO consumes oldest lots first. Weighted-average still consumes specific lots
 * (for traceability) but values the issue at the current average cost.
 */
export async function allocateCost(
  db: Db,
  productId: string,
  quantity: number,
  method?: "FIFO" | "WEIGHTED_AVERAGE",
  location: string = "ON_HAND",
): Promise<CostLayer[]> {
  if (quantity <= 0) return [];
  const costing = method ?? (await getCostingMethod(db));
  const lots = await lotsAt(db, productId, location);
  const available = lots.reduce((s, l) => s + l.qtyRemaining, 0);
  if (available + 1e-9 < quantity) {
    throw new Error(
      `Insufficient stock for product. Required ${quantity}, available ${round2(available)}.`,
    );
  }
  const avg = lots.reduce((s, l) => s + l.qtyRemaining * l.unitCost, 0) / (available || 1);
  const layers: CostLayer[] = [];
  let remaining = quantity;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qtyRemaining, remaining);
    const unitCost = costing === "WEIGHTED_AVERAGE" ? round2(avg) : lot.unitCost;
    layers.push({
      lotId: lot.id,
      quantity: take,
      unitCost,
      amount: round2(take * unitCost),
      batchNumber: lot.batchNumber,
      serialNumber: lot.serialNumber,
    });
    remaining = round2(remaining - take);
  }
  return layers;
}

export async function consumeLayers(
  db: Db,
  layers: CostLayer[],
  params: {
    productId: string;
    transactionDate: Date;
    movementType: string;
    referenceType: string;
    referenceId: string;
    notes?: string;
    newLocation?: string | null; // if set, move remaining qty to this location instead of consuming
  },
) {
  for (const layer of layers) {
    const lot = await db.inventoryLot.findUniqueOrThrow({ where: { id: layer.lotId } });
    if (params.newLocation) {
      await db.inventoryLot.update({
        where: { id: lot.id },
        data: { qtyRemaining: round2(lot.qtyRemaining - layer.quantity) },
      });
      const moved = await db.inventoryLot.create({
        data: {
          productId: params.productId,
          sourceType: params.movementType,
          sourceId: params.referenceId,
          receivedDate: params.transactionDate,
          qtyReceived: layer.quantity,
          qtyRemaining: layer.quantity,
          unitCost: layer.unitCost,
          batchNumber: lot.batchNumber,
          serialNumber: lot.serialNumber,
          expiryDate: lot.expiryDate,
          location: params.newLocation,
        },
      });
      await db.stockMovement.create({
        data: {
          productId: params.productId,
          lotId: moved.id,
          type: params.movementType,
          qty: -layer.quantity,
          unitCost: layer.unitCost,
          transactionDate: params.transactionDate,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          notes: params.notes ?? "",
        },
      });
    } else {
      await db.inventoryLot.update({
        where: { id: lot.id },
        data: { qtyRemaining: round2(lot.qtyRemaining - layer.quantity) },
      });
      await db.stockMovement.create({
        data: {
          productId: params.productId,
          lotId: lot.id,
          type: params.movementType,
          qty: -layer.quantity,
          unitCost: layer.unitCost,
          transactionDate: params.transactionDate,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          notes: params.notes ?? "",
        },
      });
    }
  }
  await refreshAverageCost(db, params.productId);
}

export async function restoreLayers(
  db: Db,
  layers: { lotId: string; quantity: number; unitCost: number }[],
  params: {
    productId: string;
    transactionDate: Date;
    movementType: string;
    referenceType: string;
    referenceId: string;
  },
) {
  for (const layer of layers) {
    const lot = await db.inventoryLot.findUnique({ where: { id: layer.lotId } });
    if (lot) {
      await db.inventoryLot.update({
        where: { id: lot.id },
        data: { qtyRemaining: round2(lot.qtyRemaining + layer.quantity) },
      });
      await db.stockMovement.create({
        data: {
          productId: params.productId,
          lotId: lot.id,
          type: params.movementType,
          qty: layer.quantity,
          unitCost: layer.unitCost,
          transactionDate: params.transactionDate,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          notes: "Void / reversal",
        },
      });
    } else {
      await createLot(db, {
        productId: params.productId,
        sourceType: params.movementType,
        sourceId: params.referenceId,
        receivedDate: params.transactionDate,
        qty: layer.quantity,
        unitCost: layer.unitCost,
      });
    }
  }
  await refreshAverageCost(db, params.productId);
}

export const COST_CODES = {
  INVENTORY: "1200",
  INVENTORY_CONSIGNED: "1210",
  COGS: "5000",
};
