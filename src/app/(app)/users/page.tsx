import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveUser, saveRole } from "@/actions/settings";
import { PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/FormBits";
import { MODULES, MODULE_LABELS, parsePermissions } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/format";

export default async function UsersPage() {
  await requireAccess("users", "view");
  const [users, roles, logs] = await Promise.all([
    prisma.user.findMany({ include: { role: true }, orderBy: { name: "asc" } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  async function userAction(formData: FormData) {
    "use server";
    const r = await saveUser(formData);
    if ("error" in r && r.error) throw new Error(String(r.error));
  }
  async function roleAction(formData: FormData) {
    "use server";
    const r = await saveRole(formData);
    if ("error" in r && r.error) throw new Error(String(r.error));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Users & permissions" subtitle="Control exactly which modules each role can access" />
      <div className="grid lg:grid-cols-2 gap-4">
        <form action={userAction} className="card p-5 space-y-3">
          <div className="font-bold">New / update user</div>
          <input className="input" name="username" placeholder="Username" required />
          <input className="input" name="name" placeholder="Display name" required />
          <input className="input" name="email" placeholder="Email" />
          <input className="input" name="password" type="password" placeholder="Password (required for new)" />
          <select className="input" name="roleId" required>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <SubmitButton>Save user</SubmitButton>
        </form>
        <div className="card overflow-hidden">
          <div className="px-5 py-3 font-bold border-b">Logins</div>
          <table className="data-table">
            <thead><tr><th>User</th><th>Role</th><th>Last login</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><div className="font-semibold">{u.name}</div><div className="text-xs text-slate-500">@{u.username}</div></td>
                  <td>{u.role.name}</td>
                  <td>{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {roles.map((role) => {
        const perms = parsePermissions(role.permissions);
        return (
          <form key={role.id} action={roleAction} className="card p-5">
            <input type="hidden" name="id" value={role.id} />
            <input type="hidden" name="name" value={role.name} />
            <input type="hidden" name="description" value={role.description} />
            <div className="font-bold mb-3">{role.name}</div>
            <div className="grid md:grid-cols-3 gap-3">
              {MODULES.map((m) => (
                <div key={m}>
                  <label className="label">{MODULE_LABELS[m]}</label>
                  <select className="input" name={`perm_${m}`} defaultValue={perms[m] || "none"}>
                    <option value="none">None</option>
                    <option value="view">View</option>
                    <option value="create">Create</option>
                    <option value="edit">Edit</option>
                    <option value="void">Void</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-3"><SubmitButton>Save role</SubmitButton></div>
          </form>
        );
      })}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 font-bold border-b">Audit trail</div>
        <table className="data-table">
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Record</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{fmtDateTime(l.createdAt)}</td>
                <td>{l.user?.name || "System"}</td>
                <td>{l.action}</td>
                <td>{l.entityType} {l.entityLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
