import { saveVendor } from "@/actions/masters";
import { requireAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/FormBits";
import { redirect } from "next/navigation";

export default async function NewVendorPage() {
  await requireAccess("vendors", "create");
  async function action(formData: FormData) {
    "use server";
    const r = await saveVendor(formData);
    if (r.error) throw new Error(r.error);
    redirect("/vendors");
  }
  return (
    <div className="max-w-3xl">
      <PageHeader title="New vendor" />
      <form action={action} className="card p-6 grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><label className="label">Vendor name *</label><input className="input" name="name" required /></div>
        <div><label className="label">Company name</label><input className="input" name="companyName" /></div>
        <div><label className="label">Contact person</label><input className="input" name="contactPerson" /></div>
        <div><label className="label">Phone</label><input className="input" name="phone" /></div>
        <div><label className="label">WhatsApp</label><input className="input" name="whatsapp" /></div>
        <div><label className="label">Email</label><input className="input" name="email" /></div>
        <div><label className="label">NTN / tax</label><input className="input" name="ntn" /></div>
        <div className="md:col-span-2"><label className="label">Address</label><textarea className="input" name="address" /></div>
        <div className="md:col-span-2"><label className="label">Bank details</label><textarea className="input" name="bankDetails" /></div>
        <div><label className="label">Payment terms</label><input className="input" name="paymentTerms" /></div>
        <div><label className="label">Opening payable</label><input className="input" name="openingBalance" type="number" step="0.01" defaultValue={0} /></div>
        <div><label className="label">Opening as of date</label><input className="input" name="transactionDate" type="date" /></div>
        <div className="md:col-span-2"><label className="label">Notes</label><textarea className="input" name="notes" /></div>
        <SubmitButton>Save vendor</SubmitButton>
      </form>
    </div>
  );
}
