"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { parseDateInput, round2 } from "@/lib/format";
import { createLot } from "@/lib/inventory";
import { ACCOUNTS, postJournal } from "@/lib/accounting";
import { saveCustomer, saveVendor, saveProduct } from "./masters";
import { createPurchase } from "./purchases";
import { createSale } from "./sales";
import { createPayment } from "./payments";

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows = lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => (rec[h] = cols[i] ?? ""));
    return rec;
  });
  return { headers, rows };
}

export async function previewImport(formData: FormData) {
  await requireAccess("settings", "edit");
  const type = String(formData.get("type") || "products");
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a CSV file." };
  const text = await file.text();
  const parsed = parseCsv(text);
  const errors: string[] = [];
  parsed.rows.forEach((row, i) => {
    if (type === "products" && !row.name && !row.product_name) errors.push(`Row ${i + 2}: name required`);
    if (type === "vendors" && !row.name && !row.vendor_name) errors.push(`Row ${i + 2}: name required`);
    if (type === "customers" && !row.name && !row.customer_name) errors.push(`Row ${i + 2}: name required`);
    if (type === "purchases" && (!row.vendor || !row.product) && (!row.vendor_code || !row.product_code))
      errors.push(`Row ${i + 2}: vendor and product required`);
    if (type === "sales" && (!row.customer || !row.product) && (!row.customer_code || !row.product_code))
      errors.push(`Row ${i + 2}: customer and product required`);
  });
  await prisma.importBatch.create({
    data: {
      type,
      filename: file.name,
      createdById: "system",
      rowCount: parsed.rows.length,
      errorCount: errors.length,
      status: "PREVIEW",
      report: JSON.stringify({ headers: parsed.headers, sample: parsed.rows.slice(0, 20), errors }),
    },
  });
  return { ok: true, headers: parsed.headers, rows: parsed.rows.slice(0, 50), total: parsed.rows.length, errors };
}

export async function commitImport(formData: FormData) {
  const user = await requireAccess("settings", "edit");
  const type = String(formData.get("type") || "products");
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a CSV file." };
  const text = await file.text();
  const { rows } = parseCsv(text);
  const errors: string[] = [];
  let ok = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (type === "products") {
        const fd = new FormData();
        fd.set("code", row.code || "");
        fd.set("name", row.name || row.product_name || "");
        fd.set("genericName", row.generic || row.generic_name || "");
        fd.set("brand", row.brand || "");
        fd.set("catalogueNumber", row.catalogue || row.catalogue_number || "");
        fd.set("purchasePrice", row.purchase_price || row.cost || "0");
        fd.set("sellingPrice", row.selling_price || row.price || "0");
        fd.set("minStock", row.min_stock || "0");
        fd.set("openingStock", row.opening_stock || "0");
        fd.set("openingCost", row.opening_cost || row.purchase_price || "0");
        fd.set("notes", row.notes || "");
        const catName = row.category || "";
        if (catName) {
          const cat = await prisma.category.findFirst({ where: { name: catName } });
          if (cat) fd.set("categoryId", cat.id);
        }
        const r = await saveProduct(fd);
        if (r.error) throw new Error(r.error);
      } else if (type === "vendors") {
        const fd = new FormData();
        fd.set("code", row.code || "");
        fd.set("name", row.name || row.vendor_name || "");
        fd.set("companyName", row.company || row.company_name || "");
        fd.set("phone", row.phone || "");
        fd.set("email", row.email || "");
        fd.set("address", row.address || "");
        fd.set("ntn", row.ntn || "");
        fd.set("openingBalance", row.opening_balance || "0");
        const r = await saveVendor(fd);
        if (r.error) throw new Error(r.error);
      } else if (type === "customers") {
        const fd = new FormData();
        fd.set("code", row.code || "");
        fd.set("name", row.name || row.customer_name || "");
        fd.set("organization", row.organization || "");
        fd.set("phone", row.phone || "");
        fd.set("email", row.email || "");
        fd.set("address", row.address || "");
        fd.set("openingBalance", row.opening_balance || "0");
        const r = await saveCustomer(fd);
        if (r.error) throw new Error(r.error);
      } else if (type === "purchases") {
        const vendor = await prisma.vendor.findFirst({
          where: { OR: [{ code: row.vendor_code || row.vendor }, { name: row.vendor || row.vendor_name }] },
        });
        const product = await prisma.product.findFirst({
          where: { OR: [{ code: row.product_code || row.product }, { name: row.product || row.product_name }] },
        });
        if (!vendor || !product) throw new Error("vendor or product not found");
        const fd = new FormData();
        fd.set("vendorId", vendor.id);
        fd.set("transactionDate", row.date || row.transaction_date || "");
        fd.set("paymentMethod", row.payment_method || "credit");
        fd.set("paidAmount", row.paid || row.paid_amount || "0");
        fd.set("referenceNumber", row.reference || "");
        fd.set("notes", row.notes || "Imported");
        fd.append("productId", product.id);
        fd.append("quantity", row.qty || row.quantity || "1");
        fd.append("unitPrice", row.unit_price || row.price || "0");
        fd.append("discount", row.discount || "0");
        fd.append("taxRate", row.tax || "0");
        fd.append("batchNumber", row.batch || "");
        fd.append("serialNumber", row.serial || "");
        fd.append("expiryDate", row.expiry || "");
        const r = await createPurchase(fd);
        if (r.error) throw new Error(r.error);
      } else if (type === "sales") {
        const customer = await prisma.customer.findFirst({
          where: { OR: [{ code: row.customer_code || row.customer }, { name: row.customer || row.customer_name }] },
        });
        const product = await prisma.product.findFirst({
          where: { OR: [{ code: row.product_code || row.product }, { name: row.product || row.product_name }] },
        });
        if (!customer || !product) throw new Error("customer or product not found");
        const fd = new FormData();
        fd.set("customerId", customer.id);
        fd.set("transactionDate", row.date || row.transaction_date || "");
        fd.set("paymentMethod", row.payment_method || "credit");
        fd.set("paidAmount", row.paid || row.paid_amount || "0");
        fd.set("referenceNumber", row.reference || "");
        fd.set("notes", row.notes || "Imported");
        fd.append("productId", product.id);
        fd.append("quantity", row.qty || row.quantity || "1");
        fd.append("sellingPrice", row.unit_price || row.price || "0");
        fd.append("discount", row.discount || "0");
        fd.append("taxRate", row.tax || "0");
        const r = await createSale(fd);
        if (r.error) throw new Error(r.error);
      } else if (type === "payments") {
        const fd = new FormData();
        fd.set("direction", (row.direction || "IN").toUpperCase());
        fd.set("partyType", (row.party_type || "CUSTOMER").toUpperCase());
        fd.set("amount", row.amount || "0");
        fd.set("transactionDate", row.date || "");
        fd.set("method", row.method || "cash");
        fd.set("notes", row.notes || "Imported");
        if (row.customer || row.customer_code) {
          const c = await prisma.customer.findFirst({
            where: { OR: [{ code: row.customer_code }, { name: row.customer }] },
          });
          if (c) fd.set("customerId", c.id);
        }
        if (row.vendor || row.vendor_code) {
          const v = await prisma.vendor.findFirst({
            where: { OR: [{ code: row.vendor_code }, { name: row.vendor }] },
          });
          if (v) fd.set("vendorId", v.id);
        }
        const r = await createPayment(fd);
        if (r.error) throw new Error(r.error);
      } else if (type === "opening_balances") {
        const kind = (row.type || row.party_type || "").toLowerCase();
        const amount = Number(row.amount || row.opening_balance || 0);
        if (kind.includes("customer")) {
          const c = await prisma.customer.findFirst({
            where: { OR: [{ code: row.code }, { name: row.name }] },
          });
          if (!c) throw new Error("customer not found");
          await prisma.customer.update({ where: { id: c.id }, data: { openingBalance: amount } });
        } else if (kind.includes("vendor")) {
          const v = await prisma.vendor.findFirst({
            where: { OR: [{ code: row.code }, { name: row.name }] },
          });
          if (!v) throw new Error("vendor not found");
          await prisma.vendor.update({ where: { id: v.id }, data: { openingBalance: amount } });
        } else if (kind.includes("stock") || kind.includes("product")) {
          const p = await prisma.product.findFirst({
            where: { OR: [{ code: row.code }, { name: row.name }] },
          });
          if (!p) throw new Error("product not found");
          const qty = Number(row.qty || row.quantity || 0);
          const cost = Number(row.cost || row.unit_cost || 0);
          if (qty > 0) {
            await createLot(prisma, {
              productId: p.id,
              sourceType: "OPENING",
              sourceId: p.id,
              receivedDate: parseDateInput(row.date || "") ,
              qty,
              unitCost: cost,
              movementType: "OPENING",
            });
            await postJournal(prisma, {
              transactionDate: parseDateInput(row.date || ""),
              createdById: user.id,
              sourceType: "OPENING",
              sourceId: p.id,
              memo: `Imported opening stock ${p.name}`,
              lines: [
                { code: ACCOUNTS.INVENTORY, debit: round2(qty * cost) },
                { code: ACCOUNTS.OPENING_EQUITY, credit: round2(qty * cost) },
              ],
            });
          }
        }
      }
      ok++;
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  await prisma.importBatch.create({
    data: {
      type,
      filename: file instanceof File ? file.name : "import.csv",
      createdById: user.id,
      rowCount: rows.length,
      errorCount: errors.length,
      status: errors.length ? "PARTIAL" : "DONE",
      report: JSON.stringify({ ok, errors }),
    },
  });
  revalidatePath("/");
  return { ok: true, imported: ok, errors };
}
