import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { updateConsignmentItem, billConsignment } from "@/actions/consignments";
import { PageHeader, DateMeta } from "@/components/ui";
import { money, round2 } from "@/lib/format";
import { SubmitButton } from "@/components/FormBits";
import { redirect } from "next/navigation";

export default async function ConsignmentDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("consignments", "view");
  const { id } = await params;
  const c = await prisma.consignment.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true } } },
  });
  if (!c) notFound();

  return (
    <div className="space-y-4">
      <PageHeader title={c.number} subtitle={`${c.customer.name} · items at customer, billed only when used`} />
      <DateMeta txn={c.transactionDate} entered={c.enteredAt} />
      {c.items.some((i) => i.qtyUsed - i.qtyBilled > 0) ? (
        <form action={async (formData: FormData) => {
          "use server";
          formData.set("consignmentId", id);
          const r = await billConsignment(formData);
          if (r.error) throw new Error(r.error);
          redirect(`/sales/${r.id}`);
        }} className="card p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">Invoice date for used items</label>
            <input className="input" type="date" name="transactionDate" />
          </div>
          <SubmitButton className="btn-green">Convert used items to invoice</SubmitButton>
        </form>
      ) : null}
      {c.items.map((item) => {
        const remaining = round2(item.qtySupplied - item.qtyUsed - item.qtyReturned);
        async function save(formData: FormData) {
          "use server";
          formData.set("itemId", item.id);
          const r = await updateConsignmentItem(formData);
          if (r.error) throw new Error(r.error);
          redirect(`/consignments/${id}`);
        }
        return (
          <form key={item.id} action={save} className="card p-5 space-y-3">
            <div className="font-bold">{item.product.name}</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div>Consigned <b>{item.qtySupplied}</b></div>
              <div>Used <b>{item.qtyUsed}</b></div>
              <div>Returned <b>{item.qtyReturned}</b></div>
              <div>Remaining <b>{remaining}</b></div>
              <div>Billable <b>{item.qtyUsed - item.qtyBilled}</b></div>
            </div>
            <div className="text-xs text-slate-500">Cost {money(item.costPrice)} · Expected sell {money(item.expectedSellingPrice)} · Batch {item.batchNumber || "—"}</div>
            <div className="grid md:grid-cols-3 gap-3">
              <div><label className="label">Used / consumed</label><input className="input" name="qtyUsed" type="number" step="0.01" defaultValue={item.qtyUsed} /></div>
              <div><label className="label">Returned</label><input className="input" name="qtyReturned" type="number" step="0.01" defaultValue={item.qtyReturned} /></div>
              <SubmitButton>Update status</SubmitButton>
            </div>
            <p className="text-xs text-slate-500">Mark used/returned here, then convert used quantities to an invoice. Billing consumes consigned lots and records actual-cost profit.</p>
          </form>
        );
      })}
    </div>
  );
}
