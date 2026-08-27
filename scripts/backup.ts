import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const db = join(process.cwd(), "prisma", "data", "lihcc.db");
const dir = join(process.cwd(), "backups");
mkdirSync(dir, { recursive: true });
if (!existsSync(db)) {
  console.error("Database not found at", db);
  process.exit(1);
}
const dest = join(dir, `lihcc-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
copyFileSync(db, dest);
console.log("Backup written to", dest);
void dirname;
