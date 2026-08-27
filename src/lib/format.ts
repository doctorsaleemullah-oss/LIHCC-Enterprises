export function money(n: number | null | undefined, symbol = "Rs"): string {
  const v = Number(n || 0);
  const abs = Math.abs(v).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${v < 0 ? "−" : ""}${symbol} ${abs}`;
}

export function moneyPlain(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateInput(d: Date | string | null | undefined): string {
  const dt = d ? (typeof d === "string" ? new Date(d) : d) : new Date();
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function initials(name: string): string {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

export function profitClass(n: number): string {
  if (n > 0.004) return "text-emerald-700";
  if (n < -0.004) return "text-red-600";
  return "text-slate-500";
}

export function statusBadge(status: string): { label: string; className: string } {
  const s = (status || "").toUpperCase();
  if (["PAID", "SETTLED", "POSTED", "ACTIVE"].includes(s))
    return { label: status, className: "badge-green" };
  if (["PARTIAL", "PARTIALLY_SETTLED", "IN_STOCK_AT_CUSTOMER", "SUPPLIED"].includes(s))
    return { label: status.replaceAll("_", " "), className: "badge-amber" };
  if (["UNPAID", "OVERDUE", "VOIDED", "EXPIRED"].includes(s))
    return { label: status.replaceAll("_", " "), className: "badge-red" };
  return { label: status.replaceAll("_", " "), className: "badge-blue" };
}

export function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}
