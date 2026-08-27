import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { globalSearch } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { money } from "@/lib/format";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAccess("dashboard", "view");
  const { q = "" } = await searchParams;
  const r = await globalSearch(q);
  return (
    <div className="space-y-4">
      <PageHeader title="Search" subtitle={q ? `Results for “${q}”` : "Type at least 2 characters"} />
      <Section title="Invoices" items={r.sales.map((s) => ({ href: `/sales/${s.id}`, label: `${s.number} · ${s.customer.name}`, extra: money(s.total) }))} />
      <Section title="Purchases" items={r.purchases.map((s) => ({ href: `/purchases/${s.id}`, label: `${s.number} · ${s.vendor.name}`, extra: money(s.total) }))} />
      <Section title="Products" items={r.products.map((s) => ({ href: `/products/${s.id}`, label: `${s.code} · ${s.name}`, extra: s.catalogueNumber }))} />
      <Section title="Customers" items={r.customers.map((s) => ({ href: `/customers/${s.id}`, label: s.name, extra: s.phone }))} />
      <Section title="Vendors" items={r.vendors.map((s) => ({ href: `/vendors/${s.id}`, label: s.name, extra: s.phone }))} />
      <Section title="Consignments" items={r.consignments.map((s) => ({ href: `/consignments/${s.id}`, label: `${s.number} · ${s.customer.name}`, extra: s.status }))} />
      <Section title="Batch / serial" items={(r.lots || []).map((s) => ({ href: `/products/${s.productId}`, label: `${s.product.name} · ${s.batchNumber || s.serialNumber}`, extra: String(s.qtyRemaining) }))} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: { href: string; label: string; extra?: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 font-bold border-b">{title}</div>
      <div className="divide-y">
        {items.map((i) => (
          <Link key={i.href + i.label} href={i.href} className="flex justify-between px-5 py-3 hover:bg-slate-50">
            <span className="font-semibold text-brand-800">{i.label}</span>
            <span className="text-sm text-slate-500">{i.extra}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
