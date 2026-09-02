# LIHCC Enterprises

Professional **Inventory, Purchase, Sales, Consignment & Accounting** system for LIHCC Enterprises.

The application records the full commercial cycle:

Vendor registration → Purchase (historical unit cost preserved) → Inventory lots → Sale or consignment → Actual-cost profit/loss → Customer payment → Ledgers → Reports.

It is designed for real operational use, including **backdated entry of 3–4 years of history**. Every document stores both **transaction date** and **date entered**.

## Open on your phone

1. On the phone, open the HTTPS link in **Safari** (iPhone) or **Chrome** (Android).
2. Sign in with `admin` / `Admin@123`.
3. **iPhone / iPad:** tap Share → **Add to Home Screen**. Use Safari, not Chrome.
4. **Android:** Chrome menu → **Install app** or **Add to Home screen**.

After that, LIHCC opens like a normal app and keeps working offline. Records stay on that phone until you use **Settings → Download JSON backup**.

GitHub Pages (after it is enabled on the repo): `https://doctorsaleemullah-oss.github.io/LIHCC-Enterprises/`

To publish from this repo: **Settings → Pages → GitHub Actions**, or deploy from the `gh-pages` branch.

## Install as an app on a computer (PWA)

The **`pwa/`** folder is an installable Progressive Web App (home screen / desktop icon, works offline after the first visit).

```bash
npm run pwa
```

Open http://localhost:4173 — Chrome or Edge will offer **Install app**. On iPhone/iPad use Safari → Share → **Add to Home Screen**.

You can also host the `pwa` folder on any HTTPS static host (GitHub Pages, Netlify, a USB web server). Service workers need `http://localhost` or HTTPS; opening the file directly (`file://`) still runs the app but cannot install.

- Login: `admin` / `Admin@123`
- Data stays in **this browser / this installed app**. Use **Settings → Download JSON backup**.
- After install, the app opens without the browser chrome and keeps working offline.

## Open a single HTML file (no server)

Download **[`LIHCC-Enterprises.html`](./LIHCC-Enterprises.html)** and open it in Chrome, Edge, or Firefox. Same records and login as the PWA, without install or offline caching.

Seeded history includes 2023–2025 purchases of the same stent at **Rs 40,000 / 45,000 / 52,000**. Selling two units from the 2023 lot at Rs 48,000 costs **Rs 40,000 each** (FIFO). Luqman Cardiac Center is a dedicated customer.

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
