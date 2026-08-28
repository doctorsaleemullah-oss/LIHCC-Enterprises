# LIHCC Enterprises

Professional **Inventory, Purchase, Sales, Consignment & Accounting** system for LIHCC Enterprises.

The application records the full commercial cycle:

Vendor registration → Purchase (historical unit cost preserved) → Inventory lots → Sale or consignment → Actual-cost profit/loss → Customer payment → Ledgers → Reports.

It is designed for real operational use, including **backdated entry of 3–4 years of history**. Every document stores both **transaction date** and **date entered**.

## Open in a browser (no install)

Download **[`LIHCC-Enterprises.html`](./LIHCC-Enterprises.html)** and open it in Chrome, Edge, or Firefox.

- Data is stored in **this browser** (`localStorage`). Use **Settings → Download JSON backup** regularly.
- Demo login: `admin` / `Admin@123`
- Seeded history includes 2023–2025 purchases of the same stent at **Rs 40,000 / 45,000 / 52,000**. Selling two units from the 2023 lot at Rs 48,000 costs **Rs 40,000 each** (FIFO). Lots are never overwritten.
- Luqman Cardiac Center is a dedicated customer. Consignments track used / returned / remaining / billable separately from completed sales.

## Login (Next.js / HTML demo)

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin@123` | Super Administrator |
| `accountant` | `Accounts@123` | Accountant |
| `inventory` | `Stock@123` | Inventory Manager |
| `sales` | `Sales@123` | Sales User |
| `viewer` | `Viewer@123` | Viewer |

Change the administrator password immediately after first login.

## Run the Next.js edition locally

The same system is also available as a Next.js + Prisma app (SQLite file on disk, bcrypt passwords, JWT cookies):

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Open http://localhost:3000

SQLite database file: `prisma/data/lihcc.db` (backed up with `npm run backup` or Settings → JSON export). For PostgreSQL later, change `DATABASE_URL` and the Prisma `provider` — the schema is otherwise standard SQL.

## Costing

Administrator setting: **FIFO** (default) or **weighted average**.

A 2023 purchase at Rs 40,000 that is later sold for Rs 48,000 always costs **Rs 40,000**, even if the same item was later purchased at Rs 45,000 and Rs 52,000. Lots are never overwritten.

## Consignment

Supply to Luqman Cardiac Center (or any customer) moves stock to a **consigned** location. Used / returned / remaining / billable quantities are tracked separately from completed sales.

## Architecture notes for later expansion

The schema already isolates lots, journals, parties and warehouses-as-locations so branches, extra companies, barcodes, POs and delivery challans can be added without rewriting history.

Set `AUTH_SECRET` and `APP_URL` in `.env` before production. Serve over HTTPS. Schedule `npm run backup`.
