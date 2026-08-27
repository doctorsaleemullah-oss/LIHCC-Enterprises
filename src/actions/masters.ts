"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { audit, takeNextNumber } from "@/lib/audit";
import { parseDateInput, round2 } from "@/lib/format";
import { createLot } from "@/lib/inventory";
import { ACCOUNTS, postJournal } from "@/lib/accounting";

async function nextCode(prefix: string, table: "customer" | "vendor" | "product") {
  const count =
    table === "customer"
      ? await prisma.customer.count()
      : table === "vendor"
        ? await prisma.vendor.count()
        : await prisma.product.count();
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function saveCustomer(formData: FormData) {
  const user = await requireAccess("customers", "edit");
  const id = String(formData.get("id") || "");
  const openingBalance = round2(Number(formData.get("openingBalance") || 0));
  const data = {
    name: String(formData.get("name") || "").trim(),
    organization: String(formData.get("organization") || ""),
    contactPerson: String(formData.get("contactPerson") || ""),
    phone: String(formData.get("phone") || ""),
    whatsapp: String(formData.get("whatsapp") || ""),
    email: String(formData.get("email") || ""),
    address: String(formData.get("address") || ""),
    ntn: String(formData.get("ntn") || ""),
    paymentTerms: String(formData.get("paymentTerms") || ""),
    openingBalance,
    notes: String(formData.get("notes") || ""),
    isActive: String(formData.get("isActive") || "true") !== "false",
    isDedicatedLihcc: String(formData.get("isDedicatedLihcc") || "") === "on",
  };
  if (!data.name) return { error: "Customer name is required." };

  if (id) {
    const prev = await prisma.customer.findUnique({ where: { id } });
    const updated = await prisma.customer.update({ where: { id }, data });
    if (prev && prev.openingBalance !== openingBalance) {
      const delta = round2(openingBalance - prev.openingBalance);
      if (delta !== 0) {
        await postJournal(prisma, {
          transactionDate: new Date(),
          createdById: user.id,
          sourceType: "OPENING",
          sourceId: id,
          memo: `Customer opening balance adjustment ${updated.name}`,
          lines:
            delta > 0
              ? [
                  { code: ACCOUNTS.AR, debit: delta, partyType: "CUSTOMER", partyId: id },
                  { code: ACCOUNTS.OPENING_EQUITY, credit: delta },
                ]
              : [
                  { code: ACCOUNTS.OPENING_EQUITY, debit: Math.abs(delta) },
                  { code: ACCOUNTS.AR, credit: Math.abs(delta), partyType: "CUSTOMER", partyId: id },
                ],
        });
      }
    }
    await audit({ user, action: "EDIT", entityType: "Customer", entityId: id, entityLabel: data.name, previousValue: prev, newValue: data });
  } else {
    const code = String(formData.get("code") || "") || (await nextCode("CUS", "customer"));
    const created = await prisma.customer.create({ data: { ...data, code } });
    if (openingBalance !== 0) {
      await postJournal(prisma, {
        transactionDate: parseDateInput(String(formData.get("transactionDate") || "")) || new Date(),
        createdById: user.id,
        sourceType: "OPENING",
        sourceId: created.id,
        memo: `Customer opening balance ${created.name}`,
        lines:
          openingBalance > 0
            ? [
                { code: ACCOUNTS.AR, debit: openingBalance, partyType: "CUSTOMER", partyId: created.id },
                { code: ACCOUNTS.OPENING_EQUITY, credit: openingBalance },
              ]
            : [
                { code: ACCOUNTS.OPENING_EQUITY, debit: Math.abs(openingBalance) },
                { code: ACCOUNTS.AR, credit: Math.abs(openingBalance), partyType: "CUSTOMER", partyId: created.id },
              ],
      });
    }
    await audit({ user, action: "CREATE", entityType: "Customer", entityId: created.id, entityLabel: created.name, newValue: data });
  }
  revalidatePath("/customers");
  return { ok: true };
}

export async function saveVendor(formData: FormData) {
  const user = await requireAccess("vendors", "edit");
  const id = String(formData.get("id") || "");
  const openingBalance = round2(Number(formData.get("openingBalance") || 0));
  const data = {
    name: String(formData.get("name") || "").trim(),
    companyName: String(formData.get("companyName") || ""),
    contactPerson: String(formData.get("contactPerson") || ""),
    phone: String(formData.get("phone") || ""),
    whatsapp: String(formData.get("whatsapp") || ""),
    email: String(formData.get("email") || ""),
    address: String(formData.get("address") || ""),
    ntn: String(formData.get("ntn") || ""),
    bankDetails: String(formData.get("bankDetails") || ""),
    paymentTerms: String(formData.get("paymentTerms") || ""),
    openingBalance,
    notes: String(formData.get("notes") || ""),
    isActive: String(formData.get("isActive") || "true") !== "false",
  };
  if (!data.name) return { error: "Vendor name is required." };

  if (id) {
    const prev = await prisma.vendor.findUnique({ where: { id } });
    await prisma.vendor.update({ where: { id }, data });
    await audit({ user, action: "EDIT", entityType: "Vendor", entityId: id, entityLabel: data.name, previousValue: prev, newValue: data });
  } else {
    const code = String(formData.get("code") || "") || (await nextCode("VEN", "vendor"));
    const created = await prisma.vendor.create({ data: { ...data, code } });
    if (openingBalance !== 0) {
      await postJournal(prisma, {
        transactionDate: parseDateInput(String(formData.get("transactionDate") || "")) || new Date(),
        createdById: user.id,
        sourceType: "OPENING",
        sourceId: created.id,
        memo: `Vendor opening balance ${created.name}`,
        lines:
          openingBalance > 0
            ? [
                { code: ACCOUNTS.OPENING_EQUITY, debit: openingBalance },
                { code: ACCOUNTS.AP, credit: openingBalance, partyType: "VENDOR", partyId: created.id },
              ]
            : [
                { code: ACCOUNTS.AP, debit: Math.abs(openingBalance), partyType: "VENDOR", partyId: created.id },
                { code: ACCOUNTS.OPENING_EQUITY, credit: Math.abs(openingBalance) },
              ],
      });
    }
    await audit({ user, action: "CREATE", entityType: "Vendor", entityId: created.id, entityLabel: created.name, newValue: data });
  }
  revalidatePath("/vendors");
  return { ok: true };
}

export async function saveProduct(formData: FormData) {
  const user = await requireAccess("products", "edit");
  const id = String(formData.get("id") || "");
  const openingStock = round2(Number(formData.get("openingStock") || 0));
  const openingCost = round2(Number(formData.get("openingCost") || 0));
  const data = {
    name: String(formData.get("name") || "").trim(),
    genericName: String(formData.get("genericName") || ""),
    description: String(formData.get("description") || ""),
    categoryId: String(formData.get("categoryId") || "") || null,
    subcategory: String(formData.get("subcategory") || ""),
    brand: String(formData.get("brand") || ""),
    modelNumber: String(formData.get("modelNumber") || ""),
    catalogueNumber: String(formData.get("catalogueNumber") || ""),
    unitId: String(formData.get("unitId") || "") || null,
    minStock: round2(Number(formData.get("minStock") || 0)),
    purchasePrice: round2(Number(formData.get("purchasePrice") || 0)),
    sellingPrice: round2(Number(formData.get("sellingPrice") || 0)),
    taxRate: round2(Number(formData.get("taxRate") || 0)),
    discountRate: round2(Number(formData.get("discountRate") || 0)),
    notes: String(formData.get("notes") || ""),
    isActive: String(formData.get("isActive") || "true") !== "false",
    imageDataUrl: String(formData.get("imageDataUrl") || ""),
  };
  if (!data.name) return { error: "Product name is required." };

  if (id) {
    const prev = await prisma.product.findUnique({ where: { id } });
    await prisma.product.update({ where: { id }, data });
    await audit({ user, action: "EDIT", entityType: "Product", entityId: id, entityLabel: data.name, previousValue: prev, newValue: data });
  } else {
    const code = String(formData.get("code") || "") || (await nextCode("ITM", "product"));
    const created = await prisma.product.create({
      data: {
        ...data,
        code,
        openingStock,
        openingCost,
        averageCost: openingCost,
        lastPurchasePrice: data.purchasePrice || openingCost,
      },
    });
    if (openingStock > 0) {
      await prisma.$transaction(async (tx) => {
        await createLot(tx, {
          productId: created.id,
          sourceType: "OPENING",
          sourceId: created.id,
          receivedDate: parseDateInput(String(formData.get("openingDate") || "")) || new Date(),
          qty: openingStock,
          unitCost: openingCost || data.purchasePrice,
          movementType: "OPENING",
        });
        const value = round2(openingStock * (openingCost || data.purchasePrice));
        if (value > 0) {
          await postJournal(tx, {
            transactionDate: parseDateInput(String(formData.get("openingDate") || "")) || new Date(),
            createdById: user.id,
            sourceType: "OPENING",
            sourceId: created.id,
            memo: `Opening stock ${created.name}`,
            lines: [
              { code: ACCOUNTS.INVENTORY, debit: value },
              { code: ACCOUNTS.OPENING_EQUITY, credit: value },
            ],
          });
        }
      });
    }
    await audit({ user, action: "CREATE", entityType: "Product", entityId: created.id, entityLabel: created.name, newValue: data });
  }
  revalidatePath("/products");
  return { ok: true };
}

export async function saveCategory(formData: FormData) {
  await requireAccess("settings", "edit");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name required." };
  await prisma.category.create({ data: { name } });
  revalidatePath("/settings");
  revalidatePath("/products");
  return { ok: true };
}

export async function adjustStock(formData: FormData) {
  const user = await requireAccess("products", "edit");
  const productId = String(formData.get("productId") || "");
  const qtyDelta = round2(Number(formData.get("qtyDelta") || 0));
  const unitCost = round2(Number(formData.get("unitCost") || 0));
  const reason = String(formData.get("reason") || "CORRECTION");
  const notes = String(formData.get("notes") || "");
  const transactionDate = parseDateInput(String(formData.get("transactionDate") || ""));
  if (!productId || qtyDelta === 0) return { error: "Enter a quantity change." };

  const number = await takeNextNumber("adjustment", "ADJ");
  await prisma.$transaction(async (tx) => {
    await tx.stockAdjustment.create({
      data: {
        number,
        productId,
        transactionDate,
        createdById: user.id,
        qtyDelta,
        unitCost,
        reason,
        notes,
      },
    });
    if (qtyDelta > 0) {
      await createLot(tx, {
        productId,
        sourceType: "ADJUSTMENT",
        sourceId: number,
        receivedDate: transactionDate,
        qty: qtyDelta,
        unitCost,
        movementType: reason === "DAMAGED" || reason === "EXPIRED" ? reason : "ADJUSTMENT",
        notes,
      });
    } else {
      const { allocateCost, consumeLayers } = await import("@/lib/inventory");
      const layers = await allocateCost(tx, productId, Math.abs(qtyDelta));
      await consumeLayers(tx, layers, {
        productId,
        transactionDate,
        movementType: reason === "DAMAGED" || reason === "EXPIRED" ? reason : "ADJUSTMENT",
        referenceType: "ADJUSTMENT",
        referenceId: number,
        notes,
      });
    }
  });
  await audit({
    user,
    action: "ADJUST",
    entityType: "Stock",
    entityId: productId,
    entityLabel: number,
    newValue: { qtyDelta, reason, transactionDate },
  });
  revalidatePath("/products");
  return { ok: true };
}
