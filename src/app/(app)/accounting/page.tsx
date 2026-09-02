import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { money } from "@/lib/format";
import Link from "next/link";

export default async function AccountingPage() {
  await requireAccess("accounting", "view");
  const accounts = await prisma.glAccount.findMany({ orderBy: { code: "asc" } });
  const lines = await prisma.journalLine.findMany({
    where: { journal: { isVoided: false } },
    include: { account: true },
  });
  const byAcc = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    const cur = byAcc.get(l.accountId) || { debit: 0, credit: 0 };
    cur.debit += l.debit;
    cur.credit += l.credit;
    byAcc.set(l.accountId, cur);
  }
  const journals = await prisma.journalEntry.findMany({
    orderBy: { transactionDate: "desc" },
    take: 40,
    include: { lines: { include: { account: true } } },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Accounting / Ledgers" subtitle="Double-entry books generated automatically from operations" />
      <div className="flex flex-wrap gap-2 no-print">
        <Link className="btn-ghost" href="/reports?type=pl">Profit & Loss</Link>
        <Link className="btn-ghost" href="/reports?type=cash">Cash book</Link>
        <Link className="btn-ghost" href="/reports?type=bank">Bank book</Link>
        <Link className="btn-ghost" href="/reports?type=ar">Receivables</Link>
        <Link className="btn-ghost" href="/reports?type=ap">Payables</Link>
        <Link className="btn-ghost" href="/reports?type=trial">Balance summary</Link>
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-3 font-bold border-b">Chart of accounts / trial balance</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Type</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const t = byAcc.get(a.id) || { debit: 0, credit: 0 };
              const nat = a.type === "ASSET" || a.type === "EXPENSE" ? t.debit - t.credit : t.credit - t.debit;
              return (
                <tr key={a.id}>
                  <td className="font-mono text-xs">{a.code}</td>
                  <td>{a.name}</td>
                  <td>{a.type}</td>
                  <td>{money(t.debit)}</td>
                  <td>{money(t.credit)}</td>
                  <td className="font-semibold">{money(nat)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-3 font-bold border-b">Recent journal entries</div>
        <div className="divide-y">
          {journals.map((j) => (
            <div key={j.id} className="p-4">
              <div className="flex justify-between text-sm font-semibold">
                <span>{j.number} · {j.memo}</span>
                <span className="text-slate-500">{j.transactionDate.toLocaleDateString("en-GB")} {j.isVoided ? "VOID" : ""}</span>
              </div>
              <table className="data-table mt-2">
                <tbody>
                  {j.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.account.code} {l.account.name}</td>
                      <td>{money(l.debit)}</td>
                      <td>{money(l.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
