import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader, DateMeta } from "@/components/ui";
import { partyLedger, vendorOutstanding } from "@/lib/accounting";
import { fmtDate, money } from "@/lib/format";

export default async function VendorDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("vendors", "view");
  const { id } = await params;
  const v = await prisma.vendor.findUnique({ where: { id } });
  if (!v) notFound();
  const purchases = await prisma.purchase.findMany({ where: { vendorId: id }, orderBy: { transactionDate: "desc" } });
  const ledger = await partyLedger("VENDOR", id);
  const outstanding = await vendorOutstanding(id);
  return (
    <div className="space-y-4">
      <PageHeader title={v.name} subtitle={v.companyName || v.code} />
      <div className="grid md:grid-cols-3 gap-4">
        <div className="kpi"><div className="lbl">Outstanding payable</div><div className="val text-lg">{money(outstanding)}</div></div>
        <div className="kpi"><div className="lbl">Purchases</div><div className="val text-lg">{money(purchases.filter((p) => p.status === "POSTED").reduce((s, p) => s + p.total, 0))}</div></div>
        <div className="kpi"><div className="lbl">Paid</div><div className="val text-lg">{money(purchases.reduce((s, p) => s + p.paidAmount, 0))}</div></div>
      </div>
      <div className="flex gap-2">
        <Link className="btn-primary" href="/purchases/new">New purchase</Link>
        <Link className="btn-ghost" href={`/payments/new?vendorId=${v.id}`}>Pay vendor</Link>
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-3 font-bold border-b">Purchases</div>
        <table className="data-table">
          <thead><tr><th>Bill</th><th>Date</th><th>Total</th><th>Paid</th></tr></thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id}>
                <td><Link className="text-brand-800 font-semibold" href={`/purchases/${p.id}`}>{p.number}</Link></td>
                <td><DateMeta txn={p.transactionDate} entered={p.enteredAt} /></td>
                <td>{money(p.total)}</td>
                <td>{money(p.paidAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-3 font-bold border-b">Vendor ledger</div>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Memo</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
          <tbody>
            {ledger.map((l) => (
              <tr key={l.id}>
                <td>{fmtDate(l.journal.transactionDate)}</td>
                <td>{l.journal.memo}</td>
                <td>{money(l.debit)}</td>
                <td>{money(l.credit)}</td>
                <td className="font-semibold">{money(l.running)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
