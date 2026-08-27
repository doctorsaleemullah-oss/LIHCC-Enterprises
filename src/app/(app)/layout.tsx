import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, MODULES, MODULE_LABELS, type ModuleKey } from "@/lib/permissions";
import { logoutAction } from "@/actions/auth";
import { GlobalSearch } from "@/components/GlobalSearch";

const NAV: { href: string; module: ModuleKey; icon: string }[] = [
  { href: "/dashboard", module: "dashboard", icon: "▣" },
  { href: "/products", module: "products", icon: "⬡" },
  { href: "/purchases", module: "purchases", icon: "↓" },
  { href: "/sales", module: "sales", icon: "↑" },
  { href: "/consignments", module: "consignments", icon: "⇄" },
  { href: "/customers", module: "customers", icon: "☺" },
  { href: "/vendors", module: "vendors", icon: "▦" },
  { href: "/payments", module: "payments", icon: "₨" },
  { href: "/expenses", module: "expenses", icon: "−" },
  { href: "/accounting", module: "accounting", icon: "☰" },
  { href: "/reports", module: "reports", icon: "▦" },
  { href: "/users", module: "users", icon: "⚙" },
  { href: "/settings", module: "settings", icon: "★" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const company = await prisma.company.findUnique({ where: { id: "default" } });
  const items = NAV.filter((n) => can(user.permissions, n.module, "view"));

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="no-print hidden md:flex w-[250px] flex-col bg-slate-900 text-slate-200">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-blue-300">Official records</div>
          <div className="mt-1 font-extrabold text-white leading-tight">{company?.name || "LIHCC Enterprises"}</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <span className="w-5 text-center opacity-70">{n.icon}</span>
              {MODULE_LABELS[n.module]}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="p-4 border-t border-white/10">
          <div className="text-xs text-slate-400 mb-2">
            {user.name}
            <div className="text-[11px] text-slate-500">{user.roleName}</div>
          </div>
          <button className="btn-ghost w-full bg-white/10 text-white hover:bg-white/20" type="submit">
            Sign out
          </button>
        </form>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link href="/dashboard" className="md:hidden font-extrabold text-brand-800">
              LIHCC
            </Link>
            <GlobalSearch />
            <div className="ml-auto text-right hidden sm:block">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-[11px] text-slate-500">{user.roleName}</div>
            </div>
          </div>
          <div className="md:hidden overflow-x-auto flex gap-1 px-3 pb-2">
            {items.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {MODULE_LABELS[n.module]}
              </Link>
            ))}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

void MODULES;
