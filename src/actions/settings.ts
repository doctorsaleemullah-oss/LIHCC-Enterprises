"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { MODULES, type AccessLevel } from "@/lib/permissions";

export async function saveCompany(formData: FormData) {
  const user = await requireAccess("settings", "edit");
  const prev = await prisma.company.findUnique({ where: { id: "default" } });
  const data = {
    name: String(formData.get("name") || "LIHCC Enterprises"),
    legalName: String(formData.get("legalName") || ""),
    registrationNo: String(formData.get("registrationNo") || ""),
    ntn: String(formData.get("ntn") || ""),
    taxInfo: String(formData.get("taxInfo") || ""),
    address: String(formData.get("address") || ""),
    city: String(formData.get("city") || ""),
    phone: String(formData.get("phone") || ""),
    phone2: String(formData.get("phone2") || ""),
    whatsapp: String(formData.get("whatsapp") || ""),
    email: String(formData.get("email") || ""),
    website: String(formData.get("website") || ""),
    description: String(formData.get("description") || ""),
    invoiceFooter: String(formData.get("invoiceFooter") || ""),
    termsAndConditions: String(formData.get("termsAndConditions") || ""),
    authorizedName: String(formData.get("authorizedName") || ""),
    authorizedTitle: String(formData.get("authorizedTitle") || ""),
    bankName: String(formData.get("bankName") || ""),
    bankAccountTitle: String(formData.get("bankAccountTitle") || ""),
    bankAccountNumber: String(formData.get("bankAccountNumber") || ""),
    bankIban: String(formData.get("bankIban") || ""),
    bankBranch: String(formData.get("bankBranch") || ""),
    invoiceTemplate: String(formData.get("invoiceTemplate") || "classic"),
    invoicePrefix: String(formData.get("invoicePrefix") || "INV"),
    purchasePrefix: String(formData.get("purchasePrefix") || "PUR"),
    consignmentPrefix: String(formData.get("consignmentPrefix") || "CON"),
    currency: String(formData.get("currency") || "PKR"),
    currencySymbol: String(formData.get("currencySymbol") || "Rs"),
    defaultTaxRate: Number(formData.get("defaultTaxRate") || 0),
    costingMethod: String(formData.get("costingMethod") || "FIFO"),
    logoDataUrl: String(formData.get("logoDataUrl") || prev?.logoDataUrl || ""),
    signatureDataUrl: String(formData.get("signatureDataUrl") || prev?.signatureDataUrl || ""),
    stampDataUrl: String(formData.get("stampDataUrl") || prev?.stampDataUrl || ""),
  };
  await prisma.company.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  await audit({ user, action: "EDIT", entityType: "Company", entityId: "default", entityLabel: data.name, previousValue: prev, newValue: data });
  revalidatePath("/");
  return { ok: true };
}

export async function saveUser(formData: FormData) {
  const actor = await requireAccess("users", "admin");
  const id = String(formData.get("id") || "");
  const username = String(formData.get("username") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "");
  const roleId = String(formData.get("roleId") || "");
  const password = String(formData.get("password") || "");
  const isActive = String(formData.get("isActive") || "true") !== "false";
  if (!username || !name || !roleId) return { error: "Username, name and role are required." };

  if (id) {
    const prev = await prisma.user.findUnique({ where: { id } });
    await prisma.user.update({
      where: { id },
      data: {
        username,
        name,
        email,
        roleId,
        isActive,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
    await audit({ user: actor, action: "EDIT", entityType: "User", entityId: id, entityLabel: username, previousValue: { username: prev?.username, roleId: prev?.roleId }, newValue: { username, roleId, isActive } });
  } else {
    if (!password) return { error: "Password is required for new users." };
    const created = await prisma.user.create({
      data: { username, name, email, roleId, isActive, passwordHash: await bcrypt.hash(password, 10) },
    });
    await audit({ user: actor, action: "CREATE", entityType: "User", entityId: created.id, entityLabel: username });
  }
  revalidatePath("/users");
  return { ok: true };
}

export async function saveRole(formData: FormData) {
  const actor = await requireAccess("users", "admin");
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Role name required." };
  const permissions: Record<string, AccessLevel> = {};
  for (const m of MODULES) {
    permissions[m] = (String(formData.get(`perm_${m}`) || "none") as AccessLevel) || "none";
  }
  const payload = { name, description: String(formData.get("description") || ""), permissions: JSON.stringify(permissions) };
  if (id) {
    const prev = await prisma.role.findUnique({ where: { id } });
    await prisma.role.update({ where: { id }, data: payload });
    await audit({ user: actor, action: "EDIT", entityType: "Role", entityId: id, entityLabel: name, previousValue: prev?.permissions, newValue: permissions });
  } else {
    const created = await prisma.role.create({ data: payload });
    await audit({ user: actor, action: "CREATE", entityType: "Role", entityId: created.id, entityLabel: name });
  }
  revalidatePath("/users");
  return { ok: true };
}

export async function saveBankAccount(formData: FormData) {
  await requireAccess("settings", "edit");
  const id = String(formData.get("id") || "");
  const data = {
    name: String(formData.get("name") || "").trim(),
    bankName: String(formData.get("bankName") || ""),
    accountTitle: String(formData.get("accountTitle") || ""),
    accountNumber: String(formData.get("accountNumber") || ""),
    iban: String(formData.get("iban") || ""),
    branch: String(formData.get("branch") || ""),
    openingBalance: Number(formData.get("openingBalance") || 0),
    isCash: String(formData.get("isCash") || "") === "on",
  };
  if (!data.name) return { error: "Name required." };
  if (id) await prisma.bankAccount.update({ where: { id }, data });
  else await prisma.bankAccount.create({ data });
  revalidatePath("/settings");
  return { ok: true };
}

export async function addAttachment(formData: FormData) {
  const user = await requireAccess("purchases", "create");
  const relatedType = String(formData.get("relatedType") || "");
  const relatedId = String(formData.get("relatedId") || "");
  const dataUrl = String(formData.get("dataUrl") || "");
  const filename = String(formData.get("filename") || "attachment");
  const mimeType = String(formData.get("mimeType") || "application/octet-stream");
  if (!relatedType || !relatedId || !dataUrl) return { error: "Missing attachment data." };
  await prisma.attachment.create({
    data: {
      filename,
      mimeType,
      dataUrl,
      relatedType,
      relatedId,
      createdById: user.id,
      saleId: relatedType === "SALE" ? relatedId : null,
      purchaseId: relatedType === "PURCHASE" ? relatedId : null,
      paymentId: relatedType === "PAYMENT" ? relatedId : null,
      expenseId: relatedType === "EXPENSE" ? relatedId : null,
      consignmentId: relatedType === "CONSIGNMENT" ? relatedId : null,
    },
  });
  revalidatePath("/");
  return { ok: true };
}

export async function markInvoiceSent(id: string) {
  await requireAccess("sales", "edit");
  await prisma.sale.update({ where: { id }, data: { sentAt: new Date() } });
  revalidatePath("/sales");
  return { ok: true };
}
