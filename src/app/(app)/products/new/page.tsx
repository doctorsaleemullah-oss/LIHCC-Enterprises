import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveProduct } from "@/actions/masters";
import { PageHeader } from "@/components/ui";
import { SubmitButton, ImageField } from "@/components/FormBits";
import { redirect } from "next/navigation";

export default async function NewProductPage() {
  await requireAccess("products", "create");
  const [categories, units] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
  ]);

  async function action(formData: FormData) {
    "use server";
    const r = await saveProduct(formData);
    if (r.error) throw new Error(r.error);
    redirect("/products");
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="New product" subtitle="Item master — historical purchase prices are stored on each purchase, not here." />
      <form action={action} className="card p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Product name *</label>
            <input className="input" name="name" required />
          </div>
          <div>
            <label className="label">Code (auto if blank)</label>
            <input className="input" name="code" />
          </div>
          <div>
            <label className="label">Generic / description</label>
            <input className="input" name="genericName" />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" name="categoryId">
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Subcategory</label>
            <input className="input" name="subcategory" />
          </div>
          <div>
            <label className="label">Brand / manufacturer</label>
            <input className="input" name="brand" />
          </div>
          <div>
            <label className="label">Model / reference</label>
            <input className="input" name="modelNumber" />
          </div>
          <div>
            <label className="label">Catalogue number</label>
            <input className="input" name="catalogueNumber" />
          </div>
          <div>
            <label className="label">Unit</label>
            <select className="input" name="unitId">
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Minimum stock</label>
            <input className="input" name="minStock" type="number" defaultValue={0} />
          </div>
          <div>
            <label className="label">Default purchase price</label>
            <input className="input" name="purchasePrice" type="number" step="0.01" />
          </div>
          <div>
            <label className="label">Selling price</label>
            <input className="input" name="sellingPrice" type="number" step="0.01" />
          </div>
          <div>
            <label className="label">Tax %</label>
            <input className="input" name="taxRate" type="number" step="0.01" defaultValue={0} />
          </div>
          <div>
            <label className="label">Opening stock (historical)</label>
            <input className="input" name="openingStock" type="number" step="0.01" defaultValue={0} />
          </div>
          <div>
            <label className="label">Opening unit cost</label>
            <input className="input" name="openingCost" type="number" step="0.01" defaultValue={0} />
          </div>
          <div>
            <label className="label">Opening stock date</label>
            <input className="input" name="openingDate" type="date" />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" name="notes" rows={3} />
        </div>
        <ImageField name="imageDataUrl" label="Product image" />
        <SubmitButton>Save product</SubmitButton>
      </form>
    </div>
  );
}
