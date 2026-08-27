import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveCompany, saveBankAccount } from "@/actions/settings";
import { saveCategory } from "@/actions/masters";
import { commitImport, previewImport } from "@/actions/import";
import { PageHeader } from "@/components/ui";
import { SubmitButton, ImageField } from "@/components/FormBits";

export default async function SettingsPage() {
  await requireAccess("settings", "view");
  const [company, banks, categories, units] = await Promise.all([
    prisma.company.findUnique({ where: { id: "default" } }),
    prisma.bankAccount.findMany(),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany(),
  ]);

  async function companyAction(formData: FormData) {
    "use server";
    const r = await saveCompany(formData);
    if ("error" in r && r.error) throw new Error(String(r.error));
  }
  async function bankAction(formData: FormData) {
    "use server";
    const r = await saveBankAccount(formData);
    if ("error" in r && r.error) throw new Error(String(r.error));
  }
  async function categoryAction(formData: FormData) {
    "use server";
    const r = await saveCategory(formData);
    if ("error" in r && r.error) throw new Error(String(r.error));
  }
  async function previewAction(formData: FormData) {
    "use server";
    const r = await previewImport(formData);
    if ("error" in r && r.error) throw new Error(String(r.error));
  }
  async function commitAction(formData: FormData) {
    "use server";
    const r = await commitImport(formData);
    if ("error" in r && r.error) throw new Error(String(r.error));
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Settings" subtitle="Company branding, numbering, costing and import" />
      <form action={companyAction} className="card p-6 grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2 font-bold">Company profile</div>
        <div><label className="label">Company name</label><input className="input" name="name" defaultValue={company?.name} /></div>
        <div><label className="label">Legal name</label><input className="input" name="legalName" defaultValue={company?.legalName} /></div>
        <div><label className="label">Registration no.</label><input className="input" name="registrationNo" defaultValue={company?.registrationNo} /></div>
        <div><label className="label">NTN / tax</label><input className="input" name="ntn" defaultValue={company?.ntn} /></div>
        <div className="md:col-span-2"><label className="label">Address</label><textarea className="input" name="address" defaultValue={company?.address} /></div>
        <div><label className="label">Phone</label><input className="input" name="phone" defaultValue={company?.phone} /></div>
        <div><label className="label">Phone 2</label><input className="input" name="phone2" defaultValue={company?.phone2} /></div>
        <div><label className="label">WhatsApp</label><input className="input" name="whatsapp" defaultValue={company?.whatsapp} /></div>
        <div><label className="label">Email</label><input className="input" name="email" defaultValue={company?.email} /></div>
        <div><label className="label">Website</label><input className="input" name="website" defaultValue={company?.website} /></div>
        <div className="md:col-span-2"><label className="label">Description</label><textarea className="input" name="description" defaultValue={company?.description} /></div>
        <div className="md:col-span-2"><label className="label">Invoice footer</label><textarea className="input" name="invoiceFooter" defaultValue={company?.invoiceFooter} /></div>
        <div className="md:col-span-2"><label className="label">Terms & conditions</label><textarea className="input" name="termsAndConditions" rows={4} defaultValue={company?.termsAndConditions} /></div>
        <div><label className="label">Authorized person</label><input className="input" name="authorizedName" defaultValue={company?.authorizedName} /></div>
        <div><label className="label">Designation</label><input className="input" name="authorizedTitle" defaultValue={company?.authorizedTitle} /></div>
        <div><label className="label">Bank name</label><input className="input" name="bankName" defaultValue={company?.bankName} /></div>
        <div><label className="label">Account title</label><input className="input" name="bankAccountTitle" defaultValue={company?.bankAccountTitle} /></div>
        <div><label className="label">Account number</label><input className="input" name="bankAccountNumber" defaultValue={company?.bankAccountNumber} /></div>
        <div><label className="label">IBAN</label><input className="input" name="bankIban" defaultValue={company?.bankIban} /></div>
        <div>
          <label className="label">Invoice template</label>
          <select className="input" name="invoiceTemplate" defaultValue={company?.invoiceTemplate}>
            <option value="classic">Classic blue</option>
            <option value="modern">Modern dark</option>
            <option value="compact">Compact green</option>
          </select>
        </div>
        <div>
          <label className="label">Costing method</label>
          <select className="input" name="costingMethod" defaultValue={company?.costingMethod}>
            <option value="FIFO">FIFO (recommended)</option>
            <option value="WEIGHTED_AVERAGE">Weighted average</option>
          </select>
        </div>
        <div><label className="label">Invoice prefix</label><input className="input" name="invoicePrefix" defaultValue={company?.invoicePrefix} /></div>
        <div><label className="label">Purchase prefix</label><input className="input" name="purchasePrefix" defaultValue={company?.purchasePrefix} /></div>
        <div><label className="label">Currency symbol</label><input className="input" name="currencySymbol" defaultValue={company?.currencySymbol} /></div>
        <div><label className="label">Default tax %</label><input className="input" name="defaultTaxRate" type="number" step="0.01" defaultValue={company?.defaultTaxRate} /></div>
        <ImageField name="logoDataUrl" label="Logo" current={company?.logoDataUrl} />
        <ImageField name="signatureDataUrl" label="Authorized signature" current={company?.signatureDataUrl} />
        <ImageField name="stampDataUrl" label="Company stamp" current={company?.stampDataUrl} />
        <div className="md:col-span-2"><SubmitButton>Save company settings</SubmitButton></div>
      </form>

      <form action={bankAction} className="card p-5 grid md:grid-cols-3 gap-3">
        <div className="md:col-span-3 font-bold">Bank / cash accounts</div>
        <input className="input" name="name" placeholder="Account name" required />
        <input className="input" name="bankName" placeholder="Bank" />
        <input className="input" name="accountNumber" placeholder="Number" />
        <label className="text-sm flex items-center gap-2"><input type="checkbox" name="isCash" /> Cash account</label>
        <SubmitButton>Add account</SubmitButton>
        <div className="md:col-span-3 text-sm text-slate-600">{banks.map((b) => b.name).join(" · ")}</div>
      </form>

      <form action={categoryAction} className="card p-5 flex gap-3 items-end">
        <div className="flex-1">
          <label className="label">New product category</label>
          <input className="input" name="name" placeholder="e.g. IVUS catheters" />
        </div>
        <SubmitButton>Add</SubmitButton>
        <div className="text-sm text-slate-500">{categories.map((c) => c.name).join(" · ")}</div>
      </form>

      <div className="card p-5 space-y-3">
        <div className="font-bold">Historical data import (CSV)</div>
        <p className="text-sm text-slate-500">Columns are matched by header name. Preview first, then commit. Supported: products, vendors, customers, purchases, sales, payments, opening_balances.</p>
        <form action={previewAction} className="flex flex-wrap gap-3">
          <select className="input w-48" name="type">
            <option>products</option>
            <option>vendors</option>
            <option>customers</option>
            <option>purchases</option>
            <option>sales</option>
            <option>payments</option>
            <option>opening_balances</option>
          </select>
          <input className="input" type="file" name="file" accept=".csv,text/csv" />
          <SubmitButton className="btn-ghost">Preview</SubmitButton>
        </form>
        <form action={commitAction} className="flex flex-wrap gap-3">
          <select className="input w-48" name="type">
            <option>products</option>
            <option>vendors</option>
            <option>customers</option>
            <option>purchases</option>
            <option>sales</option>
            <option>payments</option>
            <option>opening_balances</option>
          </select>
          <input className="input" type="file" name="file" accept=".csv,text/csv" />
          <SubmitButton>Commit import</SubmitButton>
        </form>
        <a className="btn-ghost inline-flex" href="/api/backup">Download full JSON backup</a>
        <p className="text-xs text-slate-500">Units: {units.map((u) => u.name).join(", ")}. Automatic SQLite file copies can be scheduled with <code>npm run backup</code>.</p>
      </div>
    </div>
  );
}
