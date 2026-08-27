import { loginAction } from "@/actions/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getSessionUser();
  if (session) redirect("/dashboard");
  const company = await prisma.company.findUnique({ where: { id: "default" } });

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-100">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-brand-900 via-brand-800 to-emerald-800 text-white p-12">
        <div>
          <div className="text-sm font-bold tracking-[0.2em] uppercase opacity-80">LIHCC Enterprises</div>
          <h1 className="mt-8 text-4xl font-extrabold leading-tight max-w-md">
            Inventory, Sales &amp; Accounting
          </h1>
          <p className="mt-4 text-blue-100 max-w-md leading-relaxed">
            Purchases, stock, consignments to Luqman Cardiac Center, invoicing, ledgers and profit — with
            historical costs preserved.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-blue-50/90">
          <li>✓ FIFO / weighted-average costing</li>
          <li>✓ Consignment vs billed stock</li>
          <li>✓ Backdated historical entry with audit trail</li>
          <li>✓ Multi-user roles and permissions</li>
        </ul>
      </div>
      <div className="flex items-center justify-center p-6">
        <form action={loginAction} className="card w-full max-w-md p-8">
          <div className="text-center mb-6">
            {company?.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoDataUrl} alt="" className="h-14 mx-auto mb-3" />
            ) : (
              <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-brand-700 text-white grid place-items-center text-xl font-extrabold">
                LE
              </div>
            )}
            <h2 className="text-2xl font-extrabold">{company?.name || "LIHCC Enterprises"}</h2>
            <p className="text-sm text-slate-500 mt-1">Sign in to continue</p>
          </div>
          <label className="label">Username</label>
          <input className="input mb-4" name="username" autoComplete="username" defaultValue="admin" />
          <label className="label">Password</label>
          <input className="input mb-6" name="password" type="password" autoComplete="current-password" />
          <button className="btn-primary w-full" type="submit">
            Sign in
          </button>
          <p className="text-xs text-slate-500 mt-5 text-center leading-relaxed">
            Default administrator: <strong>admin</strong> / <strong>Admin@123</strong>
            <br />
            Change this password after first login.
          </p>
        </form>
      </div>
    </div>
  );
}
