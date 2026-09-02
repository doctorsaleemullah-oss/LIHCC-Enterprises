import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader, DateMeta } from "@/components/ui";
import { customerOutstanding, partyLedger } from "@/lib/accounting";
import { fmtDate, money, profitClass } from "@/lib/format";

export default async function CustomerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string; status?: string }> }) {
  await requireAccess("customers", "view");
  const { id } = await params;
  const sp = await searchParams;
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) notFound();
  const outstanding = await customerOutstanding(id);
  const sales = await prisma.sale.findMany({
    where: {
      customerId: id,
      ...(sp.status ? { paymentStatus: sp.status } : {}),
      ...(sp.from || sp.to ? { transactionDate: { gte: sp.from ? new Date(sp.from) : undefined, lte: sp.to ? new Date(sp.to) : undefined } } : {}),
    },
    orderBy: { transactionDate: "desc" },
  });
  const consignments = await prisma.consignment.findMany({ where: { customerId: id }, include: { items: true } });
  const payments = await prisma.payment.findMany({ where: { customerId: id, status: "POSTED" }, orderBy: { transactionDate: "desc" } });
  const ledger = await partyLedger("CUSTOMER", id);
  const profit = sales.filter((s) => s.status === "POSTED").reduce((s, x) => s + x.grossProfit, 0);

  return (
    <div className="space-y-4">
      <PageHeader title={c.name} subtitle={`${c.organization || c.code}${c.isDedicatedLihcc ? " · Dedicated Luqman Cardiac Center account" : ""}`} />
      <div className="grid md:grid-cols-4 gap-4">
        <div className="kpi"><div className="lbl">Outstanding</div><div className="val text-lg">{money(outstanding)}</div></div>
        <div className="kpi"><div className="lbl">Sales</div><div className="val text-lg">{money(sales.reduce((s, x) => s + (x.status === "POSTED" ? x.total : 0), 0))}</div></div>
        <div className="kpi"><div className="lbl">Profit from this account</div><div className={`val text-lg ${profitClass(profit)}`}>{money(profit)}</div></div>
        <div className="kpi"><div className="lbl">Consignments</div><div className="val text-lg">{consignments.length}</div></div>
      </div>
      <form className="flex flex-wrap gap-2 no-print">
        <input className="input w-40" type="date" name="from" defaultValue={sp.from} />
        <input className="input w-40" type="date" name="to" defaultValue={sp.to} />
        <select className="input w-40" name="status" defaultValue={sp.status || ""}>
          <option value="">All payments</option>
          <option>UNPAID</option>
          <option>PARTIAL</option>
          <option>PAID</option>
        </select>
        <button className="btn-ghost">Filter</button>
        <Link className="btn-green" href={`/sales/new`}>New invoice</Link>
        <Link className="btn-ghost" href={`/payments/new?customerId=${c.id}`}>Record receipt</Link>
      </form>
      <div className="card overflow-hidden">
        <div className="px-5 py-3 font-bold border-b">Invoices</div>
        <table className="data-table">
          <thead><tr><th>Invoice</th><th>Date</th><th>Amount</th><th>Profit</th><th>Status</th></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td><Link className="text-brand-800 font-semibold" href={`/sales/${s.id}`}>{s.number}</Link></td>
                <td><DateMeta txn={s.transactionDate} entered={s.enteredAt} /></td>
                <td>{money(s.total)}</td>
                <td className={profitClass(s.grossProfit)}>{money(s.grossProfit)}</td>
                <td>{s.paymentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-3 font-bold border-b">Consignments</div>
        <table className="data-table">
          <thead><tr><th>No.</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            {consignments.map((x) => (
              <tr key={x.id}>
                <td><Link className="text-brand-800 font-semibold" href={`/consignments/${x.id}`}>{x.number}</Link></td>
                <td>{fmtDate(x.transactionDate)}</td>
                <td>{x.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-3 font-bold border-b">Customer ledger</div>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Memo</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
          <tbody>
            {c.openingBalance ? (
              <tr>
                <td>—</td><td>Opening balance</td><td>{money(Math.max(0, c.openingBalance))}</td><td>{money(Math.max(0, -c.openingBalance))}</td><td>{money(c.openingBalance)}</td>
              </tr>
            ) : null}
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
      <div className="text-sm text-slate-500">Payments: {payments.length} · Phone {c.phone || "—"} · {c.notes}</div>
    </div>
  );
}
