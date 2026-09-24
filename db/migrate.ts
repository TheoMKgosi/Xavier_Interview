import { readFile, mkdir } from "node:fs/promises";
import Database from "better-sqlite3";

const path = process.env.DATABASE_URL ?? "data/app.db";
const dir = path.slice(0, path.lastIndexOf("/"));
if (dir) {
  await mkdir(dir, { recursive: true });
}

const db = new Database(path);
try {
  const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf-8");
  db.exec(sql);
  console.log(`Schema applied to ${path}.`);
} finally {
  db.close();
}