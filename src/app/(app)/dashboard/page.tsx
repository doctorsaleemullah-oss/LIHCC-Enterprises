import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { dashboardStats } from "@/lib/queries";
import { fmtDateTime, money, profitClass } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import Link from "next/link";

function rangeFromParam(period?: string, from?: string, to?: string) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (from && to) return { from: new Date(from), to: new Date(to) };
  if (period === "today") return { from: start, to: now };
  if (period === "week") {
    const d = new Date(start);
    d.setDate(d.getDate() - 7);
    return { from: d, to: now };
  }
  if (period === "year") {
    return { from: new Date(now.getFullYear(), 0, 1), to: now };
  }
  if (period === "year") {
    return { from: new Date(now.getFullYear(), 0, 1), to: now };
  }
  if (period === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
  return undefined;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  await requireAccess("dashboard", "view");
  const sp = await searchParams;
  const range = rangeFromParam(sp.period, sp.from, sp.to);
  const s = await dashboardStats(range);
  const company = await prisma.company.findUnique({ where: { id: "default" } });
  const maxBar = Math.max(1, ...s.monthly.map((m) => Math.max(m.sales, m.purchases, Math.abs(m.profit))));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`${company?.name} — live financial position`} />
      <div className="no-print flex flex-wrap gap-2 mb-5">
        {[
          ["all", "All time"],
          ["year", "This year"],
          ["month", "This month"],
          ["today", "Today"],
          ["week", "This week"],
        ].map(([k, label]) => (
          <Link key={k} href={`/dashboard?period=${k}`} className={`btn-ghost ${sp.period === k || (!sp.period && k === "all") ? "bg-brand-700 text-white hover:bg-brand-800" : ""}`}>
            {label}
          </Link>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="kpi">
          <div className="lbl">Total sales</div>
          <div className="val text-emerald-700">{money(s.totalSales)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">Total purchases</div>
          <div className="val text-brand-800">{money(s.totalPurchases)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">Gross profit</div>
          <div className={`val ${profitClass(s.grossProfit)}`}>{money(s.grossProfit)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">Net profit</div>
          <div className={`val ${profitClass(s.netProfit)}`}>{money(s.netProfit)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">Receivables</div>
          <div className="val text-amber-700">{money(s.receivables)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">Payables</div>
          <div className="val text-red-700">{money(s.payables)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">Inventory value</div>
          <div className="val">{money(s.inventoryValue)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">Consignment qty</div>
          <div className="val">{s.consignmentStock}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="kpi">
          <div className="lbl">Today&apos;s sales</div>
          <div className="val text-emerald-700 text-xl">{money(s.todaySales)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">Today&apos;s purchases</div>
          <div className="val text-xl">{money(s.todayPurchases)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">Cash / Bank</div>
          <div className="val text-xl">
            {money(s.cash)} <span className="text-sm font-semibold text-slate-500">/ {money(s.bank)}</span>
          </div>
        </div>
      </div>

      <div className="card p-5 mt-5">
        <h2 className="font-bold mb-4">Monthly sales, purchases &amp; profit</h2>
        <div className="flex items-end gap-2 h-48">
          {s.monthly.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5 h-40">
                <div className="flex-1 bg-emerald-500 rounded-t" style={{ height: `${(m.sales / maxBar) * 100}%` }} title={`Sales ${money(m.sales)}`} />
                <div className="flex-1 bg-blue-500 rounded-t" style={{ height: `${(m.purchases / maxBar) * 100}%` }} title={`Purchases ${money(m.purchases)}`} />
                <div className={`flex-1 rounded-t ${m.profit >= 0 ? "bg-amber-400" : "bg-red-500"}`} style={{ height: `${(Math.abs(m.profit) / maxBar) * 100}%` }} title={`Profit ${money(m.profit)}`} />
              </div>
              <div className="text-[10px] text-slate-500">{m.month.slice(5)}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 text-xs mt-3 text-slate-500">
          <span><span className="inline-block w-2 h-2 bg-emerald-500 rounded-sm mr-1" />Sales</span>
          <span><span className="inline-block w-2 h-2 bg-blue-500 rounded-sm mr-1" />Purchases</span>
          <span><span className="inline-block w-2 h-2 bg-amber-400 rounded-sm mr-1" />Profit</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 font-bold border-b">Top-selling items</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Revenue</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {s.topItems.map((i) => (
                <tr key={i.name}>
                  <td>{i.name}</td>
                  <td>{i.qty}</td>
                  <td>{money(i.revenue)}</td>
                  <td className={profitClass(i.profit)}>{money(i.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card overflow-hidden">
          <div className="px-5 py-4 font-bold border-b">Customer-wise sales</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Sales</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {s.customerSales.map((i) => (
                <tr key={i.name}>
                  <td>{i.name}</td>
                  <td>{money(i.sales)}</td>
                  <td className={profitClass(i.profit)}>{money(i.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 font-bold border-b flex justify-between">
            Low stock <Link className="text-brand-700 text-sm" href="/products">View</Link>
          </div>
          {s.lowStock.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No items at or below minimum stock.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>On hand</th>
                  <th>Min</th>
                </tr>
              </thead>
              <tbody>
                {s.lowStock.slice(0, 8).map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="text-red-600 font-bold">{p.onHand}</td>
                    <td>{p.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card overflow-hidden">
          <div className="px-5 py-4 font-bold border-b">Pending invoices</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {s.pendingInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link className="text-brand-700 font-semibold" href={`/sales/${inv.id}`}>
                      {inv.number}
                    </Link>
                  </td>
                  <td>{inv.customer.name}</td>
                  <td>{money(inv.total - inv.paidAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden mt-4">
        <div className="px-5 py-4 font-bold border-b">Recent activity</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Action</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
            {s.recent.map((a) => (
              <tr key={a.id}>
                <td>{fmtDateTime(a.createdAt)}</td>
                <td>{a.user?.name || "System"}</td>
                <td>{a.action}</td>
                <td>
                  {a.entityType} {a.entityLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
