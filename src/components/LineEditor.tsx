"use client";

import { useMemo, useState } from "react";
import { money, round2 } from "@/lib/format";

export type ProductOption = {
  id: string;
  name: string;
  code: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
};

type Row = {
  productId: string;
  quantity: string;
  price: string;
  discount: string;
  taxRate: string;
  batchNumber: string;
  serialNumber: string;
  expiryDate: string;
};

const empty = (): Row => ({
  productId: "",
  quantity: "1",
  price: "",
  discount: "0",
  taxRate: "0",
  batchNumber: "",
  serialNumber: "",
  expiryDate: "",
});

export function LineEditor({
  products,
  priceField,
  showBatch = true,
  mode,
}: {
  products: ProductOption[];
  priceField: "unitPrice" | "sellingPrice" | "expectedSellingPrice";
  showBatch?: boolean;
  mode: "purchase" | "sale" | "consignment";
}) {
  const [rows, setRows] = useState<Row[]>([empty()]);

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const qty = Number(r.quantity || 0);
        const price = Number(r.price || 0);
        const disc = Number(r.discount || 0);
        const tax = Number(r.taxRate || 0);
        const taxable = qty * price - disc;
        const taxAmt = taxable * (tax / 100);
        acc.sub += qty * price;
        acc.disc += disc;
        acc.tax += taxAmt;
        acc.total += taxable + taxAmt;
        return acc;
      },
      { sub: 0, disc: 0, tax: 0, total: 0 },
    );
  }, [rows]);

  return (
    <div className="space-y-3">
      {rows.map((row, i) => {
        const p = products.find((x) => x.id === row.productId);
        const qty = Number(row.quantity || 0);
        const price = Number(row.price || 0);
        const disc = Number(row.discount || 0);
        const tax = Number(row.taxRate || 0);
        const line = round2(qty * price - disc + (qty * price - disc) * (tax / 100));
        return (
          <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
            <div className="grid md:grid-cols-12 gap-2">
              <select
                className="input md:col-span-5"
                name="productId"
                required={i === 0}
                value={row.productId}
                onChange={(e) => {
                  const prod = products.find((x) => x.id === e.target.value);
                  update(i, {
                    productId: e.target.value,
                    price: String(mode === "sale" || mode === "consignment" ? prod?.sellingPrice ?? "" : prod?.purchasePrice ?? ""),
                    taxRate: String(prod?.taxRate ?? 0),
                  });
                }}
              >
                <option value="">Select item…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
              <input className="input md:col-span-2" name="quantity" type="number" step="0.01" min="0" value={row.quantity} onChange={(e) => update(i, { quantity: e.target.value })} placeholder="Qty" />
              <input className="input md:col-span-2" name={priceField} type="number" step="0.01" value={row.price} onChange={(e) => update(i, { price: e.target.value })} placeholder="Price" />
              {mode !== "consignment" ? (
                <>
                  <input className="input md:col-span-1" name="discount" type="number" step="0.01" value={row.discount} onChange={(e) => update(i, { discount: e.target.value })} placeholder="Disc" />
                  <input className="input md:col-span-1" name="taxRate" type="number" step="0.01" value={row.taxRate} onChange={(e) => update(i, { taxRate: e.target.value })} placeholder="Tax %" />
                </>
              ) : (
                <div className="md:col-span-2 text-sm font-semibold self-center">{p ? `Cost ~ ${money(p.purchasePrice)}` : ""}</div>
              )}
              <button type="button" className="btn-ghost md:col-span-1" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i || rs.length === 1))}>
                ✕
              </button>
            </div>
            {showBatch ? (
              <div className="grid md:grid-cols-3 gap-2">
                <input className="input" name="batchNumber" placeholder="Batch / lot" value={row.batchNumber} onChange={(e) => update(i, { batchNumber: e.target.value })} />
                <input className="input" name="serialNumber" placeholder="Serial" value={row.serialNumber} onChange={(e) => update(i, { serialNumber: e.target.value })} />
                {mode === "purchase" ? (
                  <input className="input" name="expiryDate" type="date" value={row.expiryDate} onChange={(e) => update(i, { expiryDate: e.target.value })} />
                ) : (
                  <div className="text-sm font-bold text-emerald-700 self-center">Line {money(line)}</div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
      <button type="button" className="add-item-btn w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-bold text-brand-700" onClick={() => setRows((r) => [...r, empty()])}>
        + Add item
      </button>
      {mode !== "consignment" ? (
        <div className="card p-4 text-sm space-y-1">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>{money(totals.sub)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Discount</span>
            <span>{money(totals.disc)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Tax</span>
            <span>{money(totals.tax)}</span>
          </div>
          <div className="flex justify-between font-extrabold text-lg pt-2 border-t">
            <span>Total</span>
            <span>{money(totals.total)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
