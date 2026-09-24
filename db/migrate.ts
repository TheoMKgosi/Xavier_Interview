import { readFile } from "node:fs/promises";
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and configure Neon.");
}

const client = new Client({ connectionString: url });

try {
  await client.connect();
  const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf-8");
  await client.query(sql);
  console.log("Schema applied.");
} finally {
  await client.end();
}