import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { fmtDate, money, profitClass } from "@/lib/format";
import { ACCOUNTS } from "@/lib/accounting";
import { dashboardStats } from "@/lib/queries";
import { PrintButton } from "@/components/PrintButton";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireAccess("reports", "view");
  const { type = "sales" } = await searchParams;
  const stats = await dashboardStats();

  const sales = await prisma.sale.findMany({ where: { status: "POSTED" }, include: { customer: true, items: { include: { product: true } } }, orderBy: { transactionDate: "desc" } });
  const purchases = await prisma.purchase.findMany({ where: { status: "POSTED" }, include: { vendor: true, items: { include: { product: true } } }, orderBy: { transactionDate: "desc" } });
  const products = await prisma.product.findMany({ include: { lots: true, category: true } });

  const tabs = [
    ["sales", "Sales"],
    ["purchases", "Purchases"],
    ["profit", "Profit"],
    ["inventory", "Inventory"],
    ["pl", "P&L"],
    ["cash", "Cash book"],
    ["ar", "Receivables"],
    ["ap", "Payables"],
  ] as const;

  const cashMoves = await prisma.journalLine.findMany({
    where: { account: { code: type === "bank" ? ACCOUNTS.BANK : ACCOUNTS.CASH }, journal: { isVoided: false } },
    include: { journal: true, account: true },
    orderBy: { journal: { transactionDate: "asc" } },
  });

  return (
    <div>
      <PageHeader title="Reports" subtitle="Filter, preview, print or export CSV" />
      <div className="flex flex-wrap gap-2 mb-4 no-print">
        {tabs.map(([k, label]) => (
          <a key={k} href={`/reports?type=${k}`} className={`btn-ghost ${type === k ? "bg-brand-700 text-white hover:bg-brand-800" : ""}`}>{label}</a>
        ))}
        <a className="btn-primary" href={`/api/export?type=${type}`}>Export CSV</a>
        <PrintButton />
      </div>
      <div className="card p-5 print-sheet">
        {type === "sales" || type === "profit" ? (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr></thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.transactionDate)}</td>
                  <td>{s.number}</td>
                  <td>{s.customer.name}</td>
                  <td>{money(s.total)}</td>
                  <td>{money(s.totalCost)}</td>
                  <td className={profitClass(s.grossProfit)}>{money(s.grossProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {type === "purchases" ? (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Bill</th><th>Vendor</th><th>Total</th><th>Paid</th></tr></thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.transactionDate)}</td>
                  <td>{p.number}</td>
                  <td>{p.vendor.name}</td>
                  <td>{money(p.total)}</td>
                  <td>{money(p.paidAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {type === "inventory" ? (
          <table className="data-table">
            <thead><tr><th>Item</th><th>Category</th><th>On hand</th><th>Avg cost</th><th>Value</th></tr></thead>
            <tbody>
              {products.map((p) => {
                const onHand = p.lots.filter((l) => l.location === "ON_HAND").reduce((s, l) => s + l.qtyRemaining, 0);
                const value = p.lots.filter((l) => l.location === "ON_HAND").reduce((s, l) => s + l.qtyRemaining * l.unitCost, 0);
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.category?.name}</td>
                    <td>{onHand}</td>
                    <td>{money(p.averageCost)}</td>
                    <td>{money(value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
        {type === "pl" ? (
          <div className="max-w-lg space-y-2 text-sm">
            <Row label="Sales revenue" value={stats.totalSales} />
            <Row label="Cost of goods sold" value={-stats.totalCost} />
            <Row label="Gross profit" value={stats.grossProfit} strong />
            <Row label="Operating expenses" value={-stats.totalExpenses} />
            <Row label="Net profit / loss" value={stats.netProfit} strong />
          </div>
        ) : null}
        {type === "cash" || type === "bank" ? (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Memo</th><th>Debit</th><th>Credit</th></tr></thead>
            <tbody>
              {cashMoves.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDate(l.journal.transactionDate)}</td>
                  <td>{l.journal.memo}</td>
                  <td>{money(l.debit)}</td>
                  <td>{money(l.credit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {type === "ar" ? (
          <div className="text-lg font-bold">Total receivables {money(stats.receivables)}</div>
        ) : null}
        {type === "ap" ? (
          <div className="text-lg font-bold">Total payables {money(stats.payables)}</div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-extrabold text-lg border-t pt-2" : ""}`}>
      <span>{label}</span>
      <span className={profitClass(value)}>{money(value)}</span>
    </div>
  );
}
