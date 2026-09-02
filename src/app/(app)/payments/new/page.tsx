import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { createPayment } from "@/actions/payments";
import { PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/FormBits";
import { toDateInput } from "@/lib/format";
import { redirect } from "next/navigation";

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ customerId?: string; vendorId?: string; saleId?: string; purchaseId?: string }> }) {
  await requireAccess("payments", "create");
  const sp = await searchParams;
  const [customers, vendors, banks, sales, purchases] = await Promise.all([
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ where: { isActive: true } }),
    prisma.sale.findMany({ where: { status: "POSTED", paymentStatus: { in: ["UNPAID", "PARTIAL"] } }, include: { customer: true }, take: 50, orderBy: { transactionDate: "asc" } }),
    prisma.purchase.findMany({ where: { status: "POSTED" }, include: { vendor: true }, take: 50, orderBy: { transactionDate: "asc" } }),
  ]);

  async function action(formData: FormData) {
    "use server";
    const r = await createPayment(formData);
    if (r.error) throw new Error(r.error);
    redirect("/payments");
  }

  const defaultDir = sp.vendorId ? "OUT" : "IN";
  return (
    <div className="max-w-2xl">
      <PageHeader title="Record payment" subtitle="Full, partial or advance. Unallocated amounts remain as advances." />
      <form action={action} className="card p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Direction</label>
            <select className="input" name="direction" defaultValue={defaultDir}>
              <option value="IN">Money in (customer receipt)</option>
              <option value="OUT">Money out (vendor payment)</option>
            </select>
          </div>
          <div>
            <label className="label">Party type</label>
            <select className="input" name="partyType" defaultValue={sp.vendorId ? "VENDOR" : "CUSTOMER"}>
              <option value="CUSTOMER">Customer</option>
              <option value="VENDOR">Vendor</option>
            </select>
          </div>
          <div>
            <label className="label">Customer</label>
            <select className="input" name="customerId" defaultValue={sp.customerId || ""}>
              <option value="">—</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Vendor</label>
            <select className="input" name="vendorId" defaultValue={sp.vendorId || ""}>
              <option value="">—</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
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
            <label className="label">Method</label>
            <select className="input" name="method">
              <option value="cash">Cash</option>
              <option value="bank">Bank transfer</option>
              <option value="cheque">Cheque</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div>
            <label className="label">Account</label>
            <select className="input" name="bankAccountId">
              <option value="">—</option>
              {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Allocate to invoice (optional)</label>
            <select className="input" name="saleId" defaultValue={sp.saleId || ""}>
              <option value="">Auto — oldest first</option>
              {sales.map((s) => <option key={s.id} value={s.id}>{s.number} · {s.customer.name} · due {s.total - s.paidAmount}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Allocate to purchase (optional)</label>
            <select className="input" name="purchaseId" defaultValue={sp.purchaseId || ""}>
              <option value="">Auto — oldest first</option>
              {purchases.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.vendor.name} · due {p.total - p.paidAmount}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Reference / cheque no.</label>
            <input className="input" name="referenceNumber" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" name="notes" />
          </div>
        </div>
        <SubmitButton>Save payment</SubmitButton>
      </form>
    </div>
  );
}
