import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { createConsignment } from "@/actions/consignments";
import { PageHeader } from "@/components/ui";
import { LineEditor } from "@/components/LineEditor";
import { SubmitButton } from "@/components/FormBits";
import { toDateInput } from "@/lib/format";
import { redirect } from "next/navigation";

export default async function NewConsignmentPage() {
  await requireAccess("consignments", "create");
  const [customers, products] = await Promise.all([
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  async function action(formData: FormData) {
    "use server";
    const r = await createConsignment(formData);
    if (r.error) throw new Error(r.error);
    redirect(`/consignments/${r.id}`);
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="Supply on consignment" subtitle="Moves stock to the customer site without recording a sale until items are used." />
      <form action={action} className="space-y-4">
        <div className="card p-5 grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Customer / institution *</label>
            <select className="input" name="customerId" required>
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Transaction date</label>
            <input className="input" type="date" name="transactionDate" defaultValue={toDateInput(new Date())} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" name="notes" rows={2} />
          </div>
        </div>
        <LineEditor
          mode="consignment"
          priceField="expectedSellingPrice"
          products={products.map((p) => ({
            id: p.id, name: p.name, code: p.code, purchasePrice: p.averageCost, sellingPrice: p.sellingPrice, taxRate: 0,
          }))}
        />
        <SubmitButton>Record consignment</SubmitButton>
      </form>
    </div>
  );
}
