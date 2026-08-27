import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader, DateMeta } from "@/components/ui";
import { money } from "@/lib/format";

export default async function PaymentsPage() {
  await requireAccess("payments", "view");
  const rows = await prisma.payment.findMany({
    include: { customer: true, vendor: true, bankAccount: true },
    orderBy: { transactionDate: "desc" },
    take: 200,
  });
  return (
    <div>
      <PageHeader title="Payments" subtitle="Receipts from customers and payments to vendors" actionHref="/payments/new" actionLabel="+ Record payment" />
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Date</th>
              <th>Type</th>
              <th>Party</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Unallocated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{p.number}</td>
                <td><DateMeta txn={p.transactionDate} entered={p.enteredAt} /></td>
                <td>{p.direction === "IN" ? "Receipt" : "Payment"}</td>
                <td>
                  {p.customer ? <Link className="text-brand-800" href={`/customers/${p.customer.id}`}>{p.customer.name}</Link> : null}
                  {p.vendor ? <Link className="text-brand-800" href={`/vendors/${p.vendor.id}`}>{p.vendor.name}</Link> : null}
                </td>
                <td>{p.method} {p.bankAccount ? `· ${p.bankAccount.name}` : ""}</td>
                <td className={p.direction === "IN" ? "text-emerald-700 font-bold" : "text-red-700 font-bold"}>{money(p.amount)}</td>
                <td>{money(p.unallocated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
