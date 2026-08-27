import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader, DateMeta, EmptyState } from "@/components/ui";
import { money, statusBadge } from "@/lib/format";

export default async function PurchasesPage() {
  await requireAccess("purchases", "view");
  const rows = await prisma.purchase.findMany({
    include: { vendor: true, items: true },
    orderBy: [{ transactionDate: "desc" }, { enteredAt: "desc" }],
    take: 200,
  });
  return (
    <div>
      <PageHeader title="Purchases" subtitle="Vendor bills increase stock, cost and payables" actionHref="/purchases/new" actionLabel="+ New purchase" />
      <div className="card overflow-hidden">
        {rows.length === 0 ? <EmptyState text="No purchases yet." /> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>Vendor</th>
                <th>Items</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const b = statusBadge(r.status);
                return (
                  <tr key={r.id}>
                    <td><Link className="font-semibold text-brand-800" href={`/purchases/${r.id}`}>{r.number}</Link></td>
                    <td><DateMeta txn={r.transactionDate} entered={r.enteredAt} /></td>
                    <td>{r.vendor.name}</td>
                    <td>{r.items.length}</td>
                    <td>{money(r.total)}</td>
                    <td>{money(r.paidAmount)}</td>
                    <td><span className={b.className}>{b.label}</span></td>
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
