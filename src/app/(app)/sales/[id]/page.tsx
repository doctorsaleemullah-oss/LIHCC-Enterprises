import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { voidSale } from "@/actions/void";
import { markInvoiceSent } from "@/actions/settings";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PageHeader } from "@/components/ui";
import { money, profitClass } from "@/lib/format";
import { redirect } from "next/navigation";

export default async function SaleDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("sales", "view");
  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: true, allocations: { include: { lot: true } } } },
    },
  });
  if (!sale) notFound();
  const company = await prisma.company.findUnique({ where: { id: "default" } });
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const share = `${appUrl}/i/${sale.shareToken}`;
  const wa = sale.customer.whatsapp || sale.customer.phone;
  const waLink = wa ? `https://wa.me/${wa.replace(/\D/g, "")}?text=${encodeURIComponent("Invoice " + sale.number + " " + share)}` : `https://wa.me/?text=${encodeURIComponent("Invoice " + sale.number + " " + share)}`;
  const mail = `mailto:${sale.customer.email || ""}?subject=${encodeURIComponent(sale.number)}&body=${encodeURIComponent(share)}`;

  async function voidIt() {
    "use server";
    const r = await voidSale(id);
    if (r.error) throw new Error(r.error);
    redirect(`/sales/${id}`);
  }
  async function sent() {
    "use server";
    await markInvoiceSent(id);
    redirect(`/sales/${id}`);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={sale.number} subtitle={sale.customer.name} />
      <div className="grid md:grid-cols-4 gap-4 no-print">
        <div className="kpi"><div className="lbl">Revenue</div><div className="val text-lg">{money(sale.total)}</div></div>
        <div className="kpi"><div className="lbl">Actual cost</div><div className="val text-lg">{money(sale.totalCost)}</div></div>
        <div className="kpi"><div className="lbl">{sale.grossProfit >= 0 ? "Gross profit" : "Gross loss"}</div><div className={`val text-lg ${profitClass(sale.grossProfit)}`}>{money(sale.grossProfit)}</div></div>
        <div className="kpi"><div className="lbl">Outstanding</div><div className="val text-lg">{money(sale.total - sale.paidAmount)}</div></div>
      </div>
      <div className="no-print flex flex-wrap gap-2">
        <a className="btn-primary" href={share} target="_blank">Shareable link</a>
        <a className="btn-green" href={waLink} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className="btn-ghost" href={mail}>Email</a>
        <Link className="btn-ghost" href={`/invoices/${sale.id}/print`}>Print / PDF</Link>
        <form action={sent}><button className="btn-ghost">Mark sent</button></form>
        {sale.status === "POSTED" ? <form action={voidIt}><button className="btn-danger">Void invoice</button></form> : <span className="badge-red">VOIDED</span>}
      </div>
      <div className="card overflow-hidden no-print">
        <div className="px-5 py-3 font-bold border-b">Cost layers used (FIFO / configured method)</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Sell</th>
              <th>Actual cost</th>
              <th>Profit</th>
              <th>Lots</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((i) => (
              <tr key={i.id}>
                <td>{i.product.name}</td>
                <td>{i.quantity}</td>
                <td>{money(i.sellingPrice)}</td>
                <td>{money(i.costAmount)}</td>
                <td className={profitClass(i.profitAmount)}>{money(i.profitAmount)}</td>
                <td className="text-xs">{i.allocations.map((a) => `${a.quantity} @ ${money(a.unitCost)} (${a.lot.batchNumber || a.lot.sourceType})`).join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {company ? <InvoiceDocument company={company} sale={sale} /> : null}
    </div>
  );
}
