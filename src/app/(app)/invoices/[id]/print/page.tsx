import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PrintButton } from "@/components/PrintButton";

export default async function PrintInvoice({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("sales", "view");
  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true } } },
  });
  const company = await prisma.company.findUnique({ where: { id: "default" } });
  if (!sale || !company) notFound();
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="no-print flex gap-2">
        <PrintButton />
      </div>
      <InvoiceDocument company={company} sale={sale} />
    </div>
  );
}
