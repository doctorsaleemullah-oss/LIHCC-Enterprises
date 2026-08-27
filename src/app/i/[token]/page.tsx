import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { markInvoiceViewed } from "@/actions/sales";

export default async function PublicInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sale = await prisma.sale.findUnique({
    where: { shareToken: token },
    include: { customer: true, items: { include: { product: true } } },
  });
  const company = await prisma.company.findUnique({ where: { id: "default" } });
  if (!sale || !company || sale.status === "VOIDED") notFound();
  await markInvoiceViewed(token);
  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="text-center text-sm text-slate-500 no-print">
          Secure invoice from {company.name} · {sale.paymentStatus === "PAID" ? "Paid" : "Payment pending"}
        </div>
        <InvoiceDocument company={company} sale={sale} />
      </div>
    </div>
  );
}
