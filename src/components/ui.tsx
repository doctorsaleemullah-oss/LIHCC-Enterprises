import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
      </div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="btn-primary">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="p-10 text-center text-slate-500 text-sm">{text}</div>;
}

export function DateMeta({ txn, entered }: { txn: Date; entered: Date }) {
  const same = txn.toDateString() === entered.toDateString();
  return (
    <div className="text-xs text-slate-500">
      <div>
        <span className="font-semibold text-slate-700">Txn</span>{" "}
        {txn.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
      </div>
      {!same ? (
        <div>
          Entered {entered.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
      ) : null}
    </div>
  );
}
