import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader, DateMeta, EmptyState } from "@/components/ui";
import { money, round2, statusBadge } from "@/lib/format";

export default async function ConsignmentsPage() {
  await requireAccess("consignments", "view");
  const rows = await prisma.consignment.findMany({
    include: { customer: true, items: { include: { product: true } } },
    orderBy: { transactionDate: "desc" },
  });
  return (
    <div>
      <PageHeader title="Consignments" subtitle="Stock at customer sites — not billed until used" actionHref="/consignments/new" actionLabel="+ New consignment" />
      <div className="space-y-4">
        {rows.length === 0 ? <div className="card"><EmptyState text="No consignments yet." /></div> : rows.map((c) => {
          const supplied = c.items.reduce((s, i) => s + i.qtySupplied, 0);
          const used = c.items.reduce((s, i) => s + i.qtyUsed, 0);
          const returned = c.items.reduce((s, i) => s + i.qtyReturned, 0);
          const remaining = round2(supplied - used - returned);
          const b = statusBadge(c.status);
          return (
            <Link key={c.id} href={`/consignments/${c.id}`} className="card p-5 block hover:border-brand-200">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="font-extrabold">{c.number} · {c.customer.name}</div>
                  <DateMeta txn={c.transactionDate} entered={c.enteredAt} />
                </div>
                <span className={b.className}>{b.label}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-sm">
                <div>Consigned <b>{supplied}</b></div>
                <div>Used <b>{used}</b></div>
                <div>Returned <b>{returned}</b></div>
                <div>Remaining <b>{remaining}</b></div>
                <div>Billable <b>{used}</b></div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

void money;
