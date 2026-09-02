import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { createPurchase } from "@/actions/purchases";
import { PageHeader } from "@/components/ui";
import { LineEditor } from "@/components/LineEditor";
import { SubmitButton } from "@/components/FormBits";
import { toDateInput } from "@/lib/format";
import { redirect } from "next/navigation";

export default async function NewPurchasePage() {
  await requireAccess("purchases", "create");
  const [vendors, products, banks] = await Promise.all([
    prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ where: { isActive: true } }),
  ]);

  async function action(formData: FormData) {
    "use server";
    const r = await createPurchase(formData);
    if (r.error) throw new Error(r.error);
    redirect(`/purchases/${r.id}`);
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="New purchase" subtitle="Transaction date can be historical. Each line’s unit price is stored permanently." />
      <form action={action} className="space-y-4">
        <div className="card p-5 grid md:grid-cols-3 gap-4">
          <div>
            <label className="label">Vendor *</label>
            <select className="input" name="vendorId" required>
              <option value="">Select vendor…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Transaction date</label>
            <input className="input" type="date" name="transactionDate" defaultValue={toDateInput(new Date())} />
          </div>
          <div>
            <label className="label">Payment method</label>
            <select className="input" name="paymentMethod" defaultValue="credit">
              <option value="credit">Credit (payable)</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank transfer</option>
              <option value="cheque">Cheque</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div>
            <label className="label">Cash / bank account</label>
            <select className="input" name="bankAccountId">
              <option value="">—</option>
              {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Paid now</label>
            <input className="input" name="paidAmount" type="number" step="0.01" defaultValue={0} />
          </div>
          <div>
            <label className="label">Vendor invoice / reference</label>
            <input className="input" name="referenceNumber" />
          </div>
          <div className="md:col-span-3">
            <label className="label">Notes</label>
            <textarea className="input" name="notes" rows={2} />
          </div>
        </div>
        <LineEditor
          mode="purchase"
          priceField="unitPrice"
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            purchasePrice: p.purchasePrice,
            sellingPrice: p.sellingPrice,
            taxRate: p.taxRate,
          }))}
        />
        <SubmitButton>Post purchase</SubmitButton>
      </form>
    </div>
  );
}
