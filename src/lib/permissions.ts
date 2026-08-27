export const MODULES = [
  "dashboard",
  "products",
  "purchases",
  "sales",
  "consignments",
  "customers",
  "vendors",
  "payments",
  "expenses",
  "accounting",
  "reports",
  "users",
  "settings",
  "audit",
] as const;

export type ModuleKey = (typeof MODULES)[number];
export type AccessLevel = "none" | "view" | "create" | "edit" | "void" | "admin";

export const ACCESS_RANK: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  create: 2,
  edit: 3,
  void: 4,
  admin: 5,
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  products: "Products / Inventory",
  purchases: "Purchases",
  sales: "Sales / Invoices",
  consignments: "Consignments",
  customers: "Customers",
  vendors: "Vendors",
  payments: "Payments",
  expenses: "Expenses",
  accounting: "Accounting / Ledgers",
  reports: "Reports",
  users: "Users & Permissions",
  settings: "Settings",
  audit: "Audit Trail",
};

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<ModuleKey, AccessLevel>> = {
  "Super Administrator": Object.fromEntries(MODULES.map((m) => [m, "admin"])) as Record<
    ModuleKey,
    AccessLevel
  >,
  Accountant: {
    dashboard: "view",
    products: "view",
    purchases: "void",
    sales: "void",
    consignments: "edit",
    customers: "edit",
    vendors: "edit",
    payments: "void",
    expenses: "void",
    accounting: "admin",
    reports: "admin",
    users: "none",
    settings: "view",
    audit: "view",
  },
  "Inventory Manager": {
    dashboard: "view",
    products: "admin",
    purchases: "edit",
    sales: "view",
    consignments: "admin",
    customers: "view",
    vendors: "view",
    payments: "none",
    expenses: "none",
    accounting: "none",
    reports: "view",
    users: "none",
    settings: "none",
    audit: "view",
  },
  "Sales User": {
    dashboard: "view",
    products: "view",
    purchases: "none",
    sales: "edit",
    consignments: "view",
    customers: "edit",
    vendors: "none",
    payments: "create",
    expenses: "none",
    accounting: "none",
    reports: "view",
    users: "none",
    settings: "none",
    audit: "none",
  },
  Viewer: Object.fromEntries(MODULES.map((m) => [m, m === "users" || m === "settings" ? "none" : "view"])) as Record<
    ModuleKey,
    AccessLevel
  >,
};

export function parsePermissions(json: string): Record<string, AccessLevel> {
  try {
    return JSON.parse(json) as Record<string, AccessLevel>;
  } catch {
    return {};
  }
}

export function can(permissionsJson: string, module: ModuleKey, needed: AccessLevel): boolean {
  const perms = parsePermissions(permissionsJson);
  const have = perms[module] ?? "none";
  return ACCESS_RANK[have] >= ACCESS_RANK[needed];
}
