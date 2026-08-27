import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { createExpense } from "@/actions/payments";
import { PageHeader, DateMeta } from "@/components/ui";
import { SubmitButton } from "@/components/FormBits";
import { money, toDateInput } from "@/lib/format";

export default async function ExpensesPage() {
  await requireAccess("expenses", "view");
  const [rows, cats, banks] = await Promise.all([
    prisma.expense.findMany({ include: { category: true }, orderBy: { transactionDate: "desc" } }),
    prisma.expenseCategory.findMany(),
    prisma.bankAccount.findMany({ where: { isActive: true } }),
  ]);
  const total = rows.filter((e) => e.status === "POSTED").reduce((s, e) => s + e.amount, 0);
  async function addExpense(formData: FormData) {
    "use server";
    const r = await createExpense(formData);
    if (r.error) throw new Error(r.error);
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Expenses" subtitle="Operating costs that reduce net profit" />
      <div className="kpi max-w-xs"><div className="lbl">Total posted</div><div className="val">{money(total)}</div></div>
      <form action={addExpense} className="card p-5 grid md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="label">Payee</label>
          <input className="input" name="payee" required />
        </div>
        <div>
          <label className="label">Amount</label>
          <input className="input" name="amount" type="number" step="0.01" required />
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" name="transactionDate" type="date" defaultValue={toDateInput(new Date())} />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" name="categoryId">
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <SubmitButton>Add expense</SubmitButton>
        <div>
          <label className="label">Method</label>
          <select className="input" name="method">
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
          </select>
        </div>
        <div>
          <label className="label">Account</label>
          <select className="input" name="bankAccountId">
            <option value="">—</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-4">
          <label className="label">Notes</label>
          <input className="input" name="notes" />
        </div>
      </form>
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Date</th>
              <th>Payee</th>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{e.number}</td>
                <td><DateMeta txn={e.transactionDate} entered={e.enteredAt} /></td>
                <td>{e.payee}</td>
                <td>{e.category?.name}</td>
                <td>{money(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
