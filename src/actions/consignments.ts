"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { audit, takeNextNumber } from "@/lib/audit";
import { parseDateInput, round2 } from "@/lib/format";
import { allocateCost, consumeLayers } from "@/lib/inventory";
import { ACCOUNTS, postJournal } from "@/lib/accounting";

function itemStatus(qtySupplied: number, qtyUsed: number, qtyReturned: number, qtyBilled: number) {
  const remaining = round2(qtySupplied - qtyUsed - qtyReturned);
  if (remaining <= 0 && qtyReturned >= qtySupplied) return "RETURNED";
  if (remaining <= 0 && qtyBilled >= qtyUsed && qtyUsed > 0) return "SETTLED";
  if (qtyBilled > 0 || qtyUsed > 0 || qtyReturned > 0) return "PARTIALLY_SETTLED";
  if (remaining > 0) return "IN_STOCK_AT_CUSTOMER";
  return "SUPPLIED";
}

export async function createConsignment(formData: FormData) {
  const user = await requireAccess("consignments", "create");
  const customerId = String(formData.get("customerId") || "");
  const transactionDate = parseDateInput(String(formData.get("transactionDate") || ""));
  const notes = String(formData.get("notes") || "");
  const productIds = formData.getAll("productId").map(String);
  const qtys = formData.getAll("quantity").map(Number);
  const expected = formData.getAll("expectedSellingPrice").map(Number);
  const batches = formData.getAll("batchNumber").map(String);
  const serials = formData.getAll("serialNumber").map(String);

  if (!customerId) return { error: "Select a customer / institution." };

  const company = await prisma.company.findUnique({ where: { id: "default" } });
  const number = await takeNextNumber("consignment", company?.consignmentPrefix || "CON");

  try {
    const consignment = await prisma.$transaction(async (tx) => {
      const rows: {
        productId: string;
        qtySupplied: number;
        costPrice: number;
        expectedSellingPrice: number;
        batchNumber: string;
        serialNumber: string;
        layers: Awaited<ReturnType<typeof allocateCost>>;
      }[] = [];

      for (let i = 0; i < productIds.length; i++) {
        const productId = productIds[i];
        const qty = Number(qtys[i] || 0);
        if (!productId || qty <= 0) continue;
        const layers = await allocateCost(tx, productId, qty);
        const costPrice = round2(layers.reduce((s, l) => s + l.amount, 0) / qty);
        rows.push({
          productId,
          qtySupplied: qty,
          costPrice,
          expectedSellingPrice: Number(expected[i] || 0),
          batchNumber: batches[i] || layers[0]?.batchNumber || "",
          serialNumber: serials[i] || "",
          layers,
        });
      }
      if (!rows.length) throw new Error("Add at least one consignment item.");

      const created = await tx.consignment.create({
        data: {
          number,
          customerId,
          transactionDate,
          createdById: user.id,
          notes,
          status: "IN_STOCK_AT_CUSTOMER",
          items: {
            create: rows.map((r) => ({
              productId: r.productId,
              qtySupplied: r.qtySupplied,
              costPrice: r.costPrice,
              expectedSellingPrice: r.expectedSellingPrice,
              batchNumber: r.batchNumber,
              serialNumber: r.serialNumber,
              status: "IN_STOCK_AT_CUSTOMER",
            })),
          },
        },
        include: { items: true, customer: true },
      });

      let consignedValue = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        consignedValue += r.layers.reduce((s, l) => s + l.amount, 0);
        await consumeLayers(tx, r.layers, {
          productId: r.productId,
          transactionDate,
          movementType: "CONSIGNMENT_OUT",
          referenceType: "CONSIGNMENT",
          referenceId: created.id,
          notes: created.number,
          newLocation: "CONSIGNED",
        });
      }

      if (consignedValue > 0) {
        await postJournal(tx, {
          transactionDate,
          createdById: user.id,
          sourceType: "CONSIGNMENT",
          sourceId: created.id,
          memo: `Consignment ${created.number} supplied to ${created.customer.name}`,
          lines: [
            { code: ACCOUNTS.INVENTORY_CONSIGNED, debit: round2(consignedValue) },
            { code: ACCOUNTS.INVENTORY, credit: round2(consignedValue) },
          ],
        });
      }
      return created;
    });

    await audit({
      user,
      action: "CREATE",
      entityType: "Consignment",
      entityId: consignment.id,
      entityLabel: consignment.number,
      newValue: { number: consignment.number, customerId, transactionDate },
    });
    revalidatePath("/consignments");
    revalidatePath("/products");
    return { ok: true, id: consignment.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save consignment." };
  }
}

export async function updateConsignmentItem(formData: FormData) {
  const user = await requireAccess("consignments", "edit");
  const itemId = String(formData.get("itemId") || "");
  const qtyUsed = Number(formData.get("qtyUsed") || 0);
  const qtyReturned = Number(formData.get("qtyReturned") || 0);
  const item = await prisma.consignmentItem.findUnique({
    where: { id: itemId },
    include: { consignment: true },
  });
  if (!item) return { error: "Item not found." };
  if (qtyUsed + qtyReturned - item.qtyUsed - item.qtyReturned > item.qtySupplied - item.qtyUsed - item.qtyReturned + 0.0001) {
    // allow setting absolute used/returned
  }
  if (qtyUsed + qtyReturned > item.qtySupplied + 0.0001) {
    return { error: "Used + returned cannot exceed quantity supplied." };
  }

  const prev = { qtyUsed: item.qtyUsed, qtyReturned: item.qtyReturned };
  const extraReturn = round2(qtyReturned - item.qtyReturned);
  const extraUsed = round2(qtyUsed - item.qtyUsed);

  await prisma.$transaction(async (tx) => {
    if (extraReturn > 0) {
      const layers = await allocateCost(tx, item.productId, extraReturn, undefined, "CONSIGNED");
      await consumeLayers(tx, layers, {
        productId: item.productId,
        transactionDate: new Date(),
        movementType: "CONSIGNMENT_RETURN",
        referenceType: "CONSIGNMENT",
        referenceId: item.consignmentId,
        notes: item.consignment.number,
        newLocation: "ON_HAND",
      });
      await postJournal(tx, {
        transactionDate: new Date(),
        createdById: user.id,
        sourceType: "CONSIGNMENT_RETURN",
        sourceId: item.consignmentId,
        memo: `Consignment return ${item.consignment.number}`,
        lines: [
          { code: ACCOUNTS.INVENTORY, debit: round2(extraReturn * item.costPrice) },
          { code: ACCOUNTS.INVENTORY_CONSIGNED, credit: round2(extraReturn * item.costPrice) },
        ],
      });
    }
    if (extraUsed > 0) {
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: "CONSIGNMENT_USED",
          qty: 0,
          unitCost: item.costPrice,
          transactionDate: new Date(),
          referenceType: "CONSIGNMENT",
          referenceId: item.consignmentId,
          notes: `${item.consignment.number} used ${extraUsed}`,
        },
      });
    }

    const status = itemStatus(item.qtySupplied, qtyUsed, qtyReturned, item.qtyBilled);
    await tx.consignmentItem.update({
      where: { id: itemId },
      data: { qtyUsed, qtyReturned, status },
    });

    const all = await tx.consignmentItem.findMany({ where: { consignmentId: item.consignmentId } });
    const header = all.every((i) => i.status === "SETTLED" || i.status === "RETURNED")
      ? "SETTLED"
      : all.some((i) => i.qtyUsed > 0 || i.qtyReturned > 0 || i.qtyBilled > 0)
        ? "PARTIALLY_SETTLED"
        : "IN_STOCK_AT_CUSTOMER";
    await tx.consignment.update({ where: { id: item.consignmentId }, data: { status: header } });
  });

  await audit({
    user,
    action: "EDIT",
    entityType: "ConsignmentItem",
    entityId: itemId,
    entityLabel: item.consignment.number,
    previousValue: prev,
    newValue: { qtyUsed, qtyReturned },
  });
  revalidatePath("/consignments");
  return { ok: true };
}

export async function billConsignment(formData: FormData) {
  const user = await requireAccess("consignments", "edit");
  await requireAccess("sales", "create");
  const consignmentId = String(formData.get("consignmentId") || "");
  const c = await prisma.consignment.findUnique({
    where: { id: consignmentId },
    include: { items: { include: { product: true } }, customer: true },
  });
  if (!c) return { error: "Consignment not found." };

  const fd = new FormData();
  fd.set("customerId", c.customerId);
  fd.set("transactionDate", String(formData.get("transactionDate") || ""));
  fd.set("paymentMethod", "credit");
  fd.set("paidAmount", "0");
  fd.set("consignmentId", c.id);
  fd.set("notes", `Billed from consignment ${c.number}`);
  let any = false;
  for (const item of c.items) {
    const billable = round2(item.qtyUsed - item.qtyBilled);
    if (billable <= 0) continue;
    any = true;
    fd.append("productId", item.productId);
    fd.append("quantity", String(billable));
    fd.append("sellingPrice", String(item.expectedSellingPrice || item.product.sellingPrice));
    fd.append("discount", "0");
    fd.append("taxRate", String(item.product.taxRate));
  }
  if (!any) return { error: "Nothing billable. Mark items as used first." };

  const { createSale } = await import("./sales");
  const result = await createSale(fd);
  if (result.error || !result.id) return result;

  await prisma.$transaction(async (tx) => {
    for (const item of c.items) {
      const billable = round2(item.qtyUsed - item.qtyBilled);
      if (billable <= 0) continue;
      const qtyBilled = round2(item.qtyBilled + billable);
      await tx.consignmentItem.update({
        where: { id: item.id },
        data: {
          qtyBilled,
          status: itemStatus(item.qtySupplied, item.qtyUsed, item.qtyReturned, qtyBilled),
        },
      });
    }
    const all = await tx.consignmentItem.findMany({ where: { consignmentId: c.id } });
    const header = all.every((i) => i.status === "SETTLED" || i.status === "RETURNED")
      ? "SETTLED"
      : "PARTIALLY_SETTLED";
    await tx.consignment.update({ where: { id: c.id }, data: { status: header } });
  });

  await audit({
    user,
    action: "BILL",
    entityType: "Consignment",
    entityId: c.id,
    entityLabel: c.number,
    newValue: { saleId: result.id, saleNumber: result.number },
  });
  revalidatePath("/consignments");
  revalidatePath("/sales");
  return result;
}
