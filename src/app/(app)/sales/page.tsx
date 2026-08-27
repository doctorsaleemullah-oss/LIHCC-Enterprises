import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader, DateMeta, EmptyState } from "@/components/ui";
import { money, profitClass, statusBadge } from "@/lib/format";

export default async function SalesPage() {
  await requireAccess("sales", "view");
  const rows = await prisma.sale.findMany({
    include: { customer: true },
    orderBy: [{ transactionDate: "desc" }, { enteredAt: "desc" }],
    take: 200,
  });
  return (
    <div>
      <PageHeader title="Sales / Invoices" subtitle="Revenue, actual cost and gross profit per invoice" actionHref="/sales/new" actionLabel="+ New invoice" />
      <div className="card overflow-hidden">
        {rows.length === 0 ? <EmptyState text="No sales yet." /> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>Profit / Loss</th>
                <th>Payment</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const b = statusBadge(r.paymentStatus);
                return (
                  <tr key={r.id}>
                    <td><Link className="font-semibold text-brand-800" href={`/sales/${r.id}`}>{r.number}</Link></td>
                    <td><DateMeta txn={r.transactionDate} entered={r.enteredAt} /></td>
                    <td>{r.customer.name}{r.customer.isDedicatedLihcc ? <span className="badge-blue ml-2">LIHCC</span> : null}</td>
                    <td>{money(r.total)}</td>
                    <td>{money(r.totalCost)}</td>
                    <td className={profitClass(r.grossProfit)}>{money(r.grossProfit)}</td>
                    <td><span className={b.className}>{b.label}</span></td>
                    <td className="text-xs">{r.viewedAt ? "Viewed" : r.sentAt ? "Sent" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
