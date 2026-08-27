import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveProduct, adjustStock } from "@/actions/masters";
import { PageHeader, DateMeta } from "@/components/ui";
import { SubmitButton } from "@/components/FormBits";
import { fmtDate, money } from "@/lib/format";
import { redirect } from "next/navigation";

export default async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("products", "view");
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      unit: true,
      lots: { orderBy: { receivedDate: "asc" } },
      movements: { orderBy: [{ transactionDate: "desc" }, { enteredAt: "desc" }], take: 80 },
    },
  });
  if (!product) notFound();
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const onHand = product.lots.filter((l) => l.location === "ON_HAND").reduce((s, l) => s + l.qtyRemaining, 0);
  const consigned = product.lots.filter((l) => l.location === "CONSIGNED").reduce((s, l) => s + l.qtyRemaining, 0);
  const purchased = product.movements.filter((m) => m.type === "PURCHASE" && !m.isVoided).reduce((s, m) => s + m.qty, 0);
  const sold = product.movements.filter((m) => m.type === "SALE" && !m.isVoided).reduce((s, m) => s + Math.abs(Math.min(0, m.qty)), 0);

  async function save(formData: FormData) {
    "use server";
    formData.set("id", id);
    await saveProduct(formData);
    redirect(`/products/${id}`);
  }
  async function adjust(formData: FormData) {
    "use server";
    formData.set("productId", id);
    await adjustStock(formData);
    redirect(`/products/${id}`);
  }

  return (
    <div className="space-y-5">
      <PageHeader title={product.name} subtitle={`${product.code} · ${product.category?.name || "Uncategorised"}`} />
      <div className="grid md:grid-cols-4 gap-4">
        <div className="kpi"><div className="lbl">On hand</div><div className="val">{onHand}</div></div>
        <div className="kpi"><div className="lbl">Consigned</div><div className="val">{consigned}</div></div>
        <div className="kpi"><div className="lbl">Average cost</div><div className="val text-lg">{money(product.averageCost)}</div></div>
        <div className="kpi"><div className="lbl">Last purchase</div><div className="val text-lg">{money(product.lastPurchasePrice)}</div></div>
      </div>
      <div className="card p-5 text-sm text-slate-600">
        Opening {product.openingStock} · Purchased +{purchased} · Sold/supplied −{sold} · Current on hand {onHand}
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-4 font-bold border-b">Historical cost lots (never overwritten)</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Received</th>
              <th>Source</th>
              <th>Batch</th>
              <th>Location</th>
              <th>Received qty</th>
              <th>Remaining</th>
              <th>Unit cost</th>
            </tr>
          </thead>
          <tbody>
            {product.lots.map((l) => (
              <tr key={l.id}>
                <td>{fmtDate(l.receivedDate)}</td>
                <td>{l.sourceType}</td>
                <td>{l.batchNumber || "—"}</td>
                <td>{l.location}</td>
                <td>{l.qtyReceived}</td>
                <td className="font-semibold">{l.qtyRemaining}</td>
                <td>{money(l.unitCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-4 font-bold border-b">Stock movement history</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Txn date</th>
              <th>Entered</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Unit cost</th>
              <th>Ref</th>
            </tr>
          </thead>
          <tbody>
            {product.movements.map((m) => (
              <tr key={m.id}>
                <td><DateMeta txn={m.transactionDate} entered={m.enteredAt} /></td>
                <td>{fmtDate(m.enteredAt)}</td>
                <td>{m.type}</td>
                <td className={m.qty < 0 ? "text-red-600" : "text-emerald-700"}>{m.qty > 0 ? "+" : ""}{m.qty}</td>
                <td>{money(m.unitCost)}</td>
                <td className="text-xs">{m.notes || m.referenceType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={adjust} className="card p-5 grid md:grid-cols-5 gap-3 items-end">
        <div>
          <label className="label">Adjustment qty (+/−)</label>
          <input className="input" name="qtyDelta" type="number" step="0.01" required />
        </div>
        <div>
          <label className="label">Unit cost (if adding)</label>
          <input className="input" name="unitCost" type="number" step="0.01" defaultValue={product.averageCost} />
        </div>
        <div>
          <label className="label">Reason</label>
          <select className="input" name="reason">
            <option>CORRECTION</option>
            <option>DAMAGED</option>
            <option>EXPIRED</option>
            <option>OTHER</option>
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" name="transactionDate" type="date" />
        </div>
        <SubmitButton>Post adjustment</SubmitButton>
        <input className="input md:col-span-5" name="notes" placeholder="Notes" />
      </form>
      <form action={save} className="card p-5 grid md:grid-cols-2 gap-4">
        <input type="hidden" name="id" value={product.id} />
        <div className="md:col-span-2 font-bold">Edit master (does not change historical lot costs)</div>
        <div><label className="label">Name</label><input className="input" name="name" defaultValue={product.name} /></div>
        <div>
          <label className="label">Category</label>
          <select className="input" name="categoryId" defaultValue={product.categoryId || ""}>
            <option value="">—</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="label">Brand</label><input className="input" name="brand" defaultValue={product.brand} /></div>
        <div><label className="label">Selling price</label><input className="input" name="sellingPrice" type="number" step="0.01" defaultValue={product.sellingPrice} /></div>
        <div><label className="label">Default purchase price</label><input className="input" name="purchasePrice" type="number" step="0.01" defaultValue={product.purchasePrice} /></div>
        <div><label className="label">Min stock</label><input className="input" name="minStock" type="number" defaultValue={product.minStock} /></div>
        <div className="md:col-span-2"><label className="label">Notes</label><textarea className="input" name="notes" defaultValue={product.notes} /></div>
        <SubmitButton>Save changes</SubmitButton>
        <Link className="btn-ghost" href="/products">Back</Link>
      </form>
    </div>
  );
}
