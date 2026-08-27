import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { voidPurchase } from "@/actions/void";
import { PageHeader, DateMeta } from "@/components/ui";
import { fmtDate, money } from "@/lib/format";
import { redirect } from "next/navigation";

export default async function PurchaseDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("purchases", "view");
  const { id } = await params;
  const p = await prisma.purchase.findUnique({
    where: { id },
    include: { vendor: true, items: { include: { product: true } }, attachments: true },
  });
  if (!p) notFound();

  async function voidIt() {
    "use server";
    const r = await voidPurchase(id);
    if (r.error) throw new Error(r.error);
    redirect(`/purchases/${id}`);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={p.number} subtitle={p.vendor.name} />
      <div className="grid md:grid-cols-4 gap-4">
        <div className="kpi"><div className="lbl">Transaction date</div><div className="val text-lg">{fmtDate(p.transactionDate)}</div></div>
        <div className="kpi"><div className="lbl">Entered</div><div className="val text-lg">{fmtDate(p.enteredAt)}</div></div>
        <div className="kpi"><div className="lbl">Total</div><div className="val text-lg">{money(p.total)}</div></div>
        <div className="kpi"><div className="lbl">Outstanding</div><div className="val text-lg">{money(p.total - p.paidAmount)}</div></div>
      </div>
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit cost (preserved)</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Line total</th>
              <th>Batch</th>
            </tr>
          </thead>
          <tbody>
            {p.items.map((i) => (
              <tr key={i.id}>
                <td><Link href={`/products/${i.productId}`} className="text-brand-800 font-semibold">{i.product.name}</Link></td>
                <td>{i.quantity}</td>
                <td className="font-bold">{money(i.unitPrice)}</td>
                <td>{money(i.discount)}</td>
                <td>{money(i.taxAmount)}</td>
                <td>{money(i.lineTotal)}</td>
                <td>{i.batchNumber || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500">{p.notes}</p>
      {p.status === "POSTED" ? (
        <form action={voidIt}>
          <button className="btn-danger">Void purchase (reverses stock if unused)</button>
        </form>
      ) : (
        <div className="badge-red">VOIDED</div>
      )}
      <DateMeta txn={p.transactionDate} entered={p.enteredAt} />
    </div>
  );
}
