import { fmtDate, money } from "@/lib/format";
import type { Company, Customer, Sale, SaleItem, Product } from "@prisma/client";

type SaleFull = Sale & {
  customer: Customer;
  items: (SaleItem & { product: Product })[];
};

export function InvoiceDocument({ company, sale }: { company: Company; sale: SaleFull }) {
  const tpl = company.invoiceTemplate || "classic";
  const headerBg = tpl === "modern" ? "bg-slate-900" : tpl === "compact" ? "bg-emerald-800" : "bg-brand-800";
  return (
    <div className={`print-sheet card overflow-hidden ${tpl}`}>
      <div className={`${headerBg} text-white px-8 py-6 flex items-start justify-between gap-4`}>
        <div>
          {company.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoDataUrl} alt="" className="h-12 mb-2 bg-white rounded p-1" />
          ) : null}
          <div className="text-2xl font-extrabold">{company.name}</div>
          <div className="text-sm opacity-90 whitespace-pre-line">{company.address}</div>
          <div className="text-sm opacity-90">
            {company.phone} {company.email}
          </div>
          {company.ntn ? <div className="text-xs mt-1">NTN {company.ntn}</div> : null}
        </div>
        <div className="text-right">
          <div className="text-sm uppercase tracking-widest opacity-80">Tax Invoice</div>
          <div className="text-2xl font-extrabold">{sale.number}</div>
          <div className="text-sm mt-2">Date {fmtDate(sale.transactionDate)}</div>
          <div className="text-xs opacity-80">Entered {fmtDate(sale.enteredAt)}</div>
          <div className="mt-2 text-xs font-bold">{sale.paymentStatus}</div>
        </div>
      </div>
      <div className="px-8 py-5 grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs font-bold uppercase text-slate-500">Bill to</div>
          <div className="font-bold text-lg">{sale.customer.name}</div>
          <div>{sale.customer.organization}</div>
          <div className="whitespace-pre-line">{sale.customer.address}</div>
          <div>{sale.customer.phone} {sale.customer.email}</div>
          {sale.customer.ntn ? <div>NTN {sale.customer.ntn}</div> : null}
        </div>
        <div className="md:text-right">
          <div>Reference: {sale.referenceNumber || "—"}</div>
          {company.bankName ? (
            <div className="mt-2">
              <div className="text-xs font-bold uppercase text-slate-500">Bank details</div>
              <div>{company.bankName}</div>
              <div>{company.bankAccountTitle}</div>
              <div>{company.bankAccountNumber}</div>
              <div>{company.bankIban}</div>
            </div>
          ) : null}
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Discount</th>
            <th>Tax</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((i, idx) => (
            <tr key={i.id}>
              <td>{idx + 1}</td>
              <td>
                <div className="font-semibold">{i.product.name}</div>
                <div className="text-xs text-slate-500">{i.product.catalogueNumber} {i.product.brand}</div>
              </td>
              <td>{i.quantity}</td>
              <td>{money(i.sellingPrice, company.currencySymbol)}</td>
              <td>{money(i.discount, company.currencySymbol)}</td>
              <td>{money(i.taxAmount, company.currencySymbol)}</td>
              <td className="font-semibold">{money(i.lineTotal, company.currencySymbol)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-8 py-5 flex justify-end">
        <div className="w-72 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(sale.subtotal, company.currencySymbol)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>{money(sale.discountAmount, company.currencySymbol)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{money(sale.taxAmount, company.currencySymbol)}</span></div>
          <div className="flex justify-between font-extrabold text-lg border-t pt-2"><span>Total</span><span>{money(sale.total, company.currencySymbol)}</span></div>
          <div className="flex justify-between"><span>Paid</span><span>{money(sale.paidAmount, company.currencySymbol)}</span></div>
          <div className="flex justify-between font-bold"><span>Balance</span><span>{money(sale.total - sale.paidAmount, company.currencySymbol)}</span></div>
        </div>
      </div>
      <div className="px-8 pb-8 grid md:grid-cols-2 gap-8 text-xs text-slate-600">
        <div>
          <div className="font-bold text-slate-800 mb-1">Terms & conditions</div>
          <div className="whitespace-pre-line">{company.termsAndConditions}</div>
          <div className="mt-3">{company.invoiceFooter}</div>
        </div>
        <div className="text-right">
          {company.stampDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.stampDataUrl} alt="" className="h-16 ml-auto mb-2 opacity-80" />
          ) : null}
          {company.signatureDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.signatureDataUrl} alt="" className="h-12 ml-auto" />
          ) : null}
          <div className="font-bold text-slate-800">{company.authorizedName}</div>
          <div>{company.authorizedTitle}</div>
        </div>
      </div>
    </div>
  );
}
