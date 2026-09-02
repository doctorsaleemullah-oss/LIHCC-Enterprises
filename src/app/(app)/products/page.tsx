import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui";
import { money } from "@/lib/format";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAccess("products", "view");
  const { q } = await searchParams;
  const products = await prisma.product.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { code: { contains: q } },
            { catalogueNumber: { contains: q } },
            { brand: { contains: q } },
          ],
        }
      : undefined,
    include: { category: true, unit: true, lots: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader title="Products / Inventory" subtitle="Medical item master, stock and valuation" actionHref="/products/new" actionLabel="+ New item" />
      <form className="mb-4">
        <input className="input max-w-md" name="q" defaultValue={q} placeholder="Search items, catalogue, brand…" />
      </form>
      <div className="card overflow-hidden">
        {products.length === 0 ? (
          <EmptyState text="No products yet." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>On hand</th>
                  <th>Consigned</th>
                  <th>Avg cost</th>
                  <th>Last purchase</th>
                  <th>Selling</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const onHand = p.lots.filter((l) => l.location === "ON_HAND").reduce((s, l) => s + l.qtyRemaining, 0);
                  const consigned = p.lots.filter((l) => l.location === "CONSIGNED").reduce((s, l) => s + l.qtyRemaining, 0);
                  const value = p.lots.reduce((s, l) => s + l.qtyRemaining * l.unitCost, 0);
                  return (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.code}</td>
                      <td>
                        <Link className="font-semibold text-brand-800" href={`/products/${p.id}`}>
                          {p.name}
                        </Link>
                        <div className="text-xs text-slate-500">{p.brand} {p.catalogueNumber}</div>
                      </td>
                      <td>{p.category?.name || "—"}</td>
                      <td className={onHand <= p.minStock ? "text-red-600 font-bold" : "font-semibold"}>{onHand}</td>
                      <td>{consigned}</td>
                      <td>{money(p.averageCost)}</td>
                      <td>{money(p.lastPurchasePrice)}</td>
                      <td>{money(p.sellingPrice)}</td>
                      <td>{money(value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
