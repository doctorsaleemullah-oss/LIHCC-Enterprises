import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { customerOutstanding } from "@/lib/accounting";
import { money } from "@/lib/format";

export default async function CustomersPage() {
  await requireAccess("customers", "view");
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  const rows = [];
  for (const c of customers) {
    const sales = await prisma.sale.aggregate({ where: { customerId: c.id, status: "POSTED" }, _sum: { total: true, paidAmount: true, grossProfit: true } });
    rows.push({
      ...c,
      totalSales: sales._sum.total || 0,
      received: sales._sum.paidAmount || 0,
      profit: sales._sum.grossProfit || 0,
      outstanding: await customerOutstanding(c.id),
    });
  }
  return (
    <div>
      <PageHeader title="Customers" subtitle="Hospitals, clinics and Luqman Cardiac Center" actionHref="/customers/new" actionLabel="+ New customer" />
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Sales</th>
              <th>Received</th>
              <th>Outstanding</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-xs">{c.code}</td>
                <td>
                  <Link className="font-semibold text-brand-800" href={`/customers/${c.id}`}>{c.name}</Link>
                  {c.isDedicatedLihcc ? <span className="badge-blue ml-2">Luqman Cardiac Center</span> : null}
                  <div className="text-xs text-slate-500">{c.organization}</div>
                </td>
                <td>{c.phone || "—"}</td>
                <td>{money(c.totalSales)}</td>
                <td>{money(c.received)}</td>
                <td className="font-bold">{money(c.outstanding)}</td>
                <td>{money(c.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
