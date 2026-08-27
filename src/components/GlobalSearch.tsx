"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const router = useRouter();
  const t = useRef<number | null>(null);

  function go(value: string) {
    const v = value.trim();
    if (v.length >= 2) router.push(`/search?q=${encodeURIComponent(v)}`);
  }

  return (
    <input
      className="input max-w-xl"
      placeholder="Search invoices, products, customers, vendors, batch / serial…"
      value={q}
      onChange={(e) => {
        setQ(e.target.value);
        if (t.current) window.clearTimeout(t.current);
        t.current = window.setTimeout(() => go(e.target.value), 400);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") go(q);
      }}
    />
  );
}
