import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { vendorOutstanding } from "@/lib/accounting";
import { money } from "@/lib/format";

export default async function VendorsPage() {
  await requireAccess("vendors", "view");
  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" } });
  const rows = [];
  for (const v of vendors) {
    const p = await prisma.purchase.aggregate({ where: { vendorId: v.id, status: "POSTED" }, _sum: { total: true, paidAmount: true } });
    rows.push({
      ...v,
      totalPurchases: p._sum.total || 0,
      paid: p._sum.paidAmount || 0,
      outstanding: await vendorOutstanding(v.id),
    });
  }
  return (
    <div>
      <PageHeader title="Vendors / Suppliers" actionHref="/vendors/new" actionLabel="+ New vendor" />
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Vendor</th>
              <th>Phone</th>
              <th>Purchases</th>
              <th>Paid</th>
              <th>Payable</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td className="font-mono text-xs">{v.code}</td>
                <td>
                  <Link className="font-semibold text-brand-800" href={`/vendors/${v.id}`}>{v.name}</Link>
                  <div className="text-xs text-slate-500">{v.companyName}</div>
                </td>
                <td>{v.phone || "—"}</td>
                <td>{money(v.totalPurchases)}</td>
                <td>{money(v.paid)}</td>
                <td className="font-bold">{money(v.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
