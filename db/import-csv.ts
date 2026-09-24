import { readFile, mkdir } from "node:fs/promises";
import Database from "better-sqlite3";

const DB_PATH = process.env.DATABASE_URL ?? "data/app.db";
const DATA_DIR = "db";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function toNumber(value: string): number | null {
  const cleaned = value.trim().replace("P", "").replace(/\s+/g, "").replace(/,/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

function toInt(value: string): number | null {
  const n = toNumber(value);
  return n === null ? null : Math.trunc(n);
}

function normalizeDate(value: string): string | null {
  const v = value.trim();
  if (v === "") return null;
  // 2026-10-01 16:18 (ISO-ish) or 2026-10-01
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 16);
  // 02/10/2026 (dd/mm/yyyy)
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return v;
}

function headerIndex(headers: string[], name: string): number {
  const idx = headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  if (idx === -1) throw new Error(`Missing column "${name}"`);
  return idx;
}

function get(headers: string[], row: string[], name: string): string {
  return row[headerIndex(headers, name)]?.trim() ?? "";
}

const dir = DB_PATH.slice(0, DB_PATH.lastIndexOf("/"));
if (dir) await mkdir(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

try {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf-8");
  db.exec(schema);

  // ---- Loans ----
  const loansText = await readFile(`${DATA_DIR}/kopano_data.xlsx - Loans.csv`, "utf-8");
  const loanRows = parseCsv(loansText);
  const loanHeaders = loanRows[0];
  const insertLoan = db.prepare(`insert or replace into loans (
    loan_id, borrower_id, first_name, last_name, phone, id_last4, branch, loan_officer,
    product, disbursed_on, principal_bwp, term_months, monthly_instalment_bwp,
    instalments_paid, arrears_bwp, penalties_bwp, outstanding_balance_bwp,
    next_due_date, days_overdue, status, payment_holiday_used
  ) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertLoans = db.transaction(() => {
    let count = 0;
    for (const row of loanRows.slice(1)) {
      insertLoan.run(
        get(loanHeaders, row, "loan_id"),
        get(loanHeaders, row, "borrower_id"),
        get(loanHeaders, row, "first_name"),
        get(loanHeaders, row, "last_name"),
        get(loanHeaders, row, "phone"),
        get(loanHeaders, row, "id_last4"),
        get(loanHeaders, row, "branch"),
        get(loanHeaders, row, "loan_officer"),
        get(loanHeaders, row, "product"),
        get(loanHeaders, row, "disbursed_on"),
        toNumber(get(loanHeaders, row, "principal_bwp")),
        toInt(get(loanHeaders, row, "term_months")),
        toNumber(get(loanHeaders, row, "monthly_instalment_bwp")),
        toInt(get(loanHeaders, row, "instalments_paid")),
        toNumber(get(loanHeaders, row, "arrears_bwp")),
        toNumber(get(loanHeaders, row, "penalties_bwp")),
        toNumber(get(loanHeaders, row, "outstanding_balance_bwp")),
        get(loanHeaders, row, "next_due_date"),
        toInt(get(loanHeaders, row, "days_overdue")),
        get(loanHeaders, row, "status"),
        get(loanHeaders, row, "payment_holiday_used"),
      );
      count += 1;
    }
    return count;
  })();

  // ---- Payments ----
  const paymentsText = await readFile(`${DATA_DIR}/kopano_data.xlsx - Payments.csv`, "utf-8");
  const paymentRows = parseCsv(paymentsText);
  const paymentHeaders = paymentRows[0];
  const insertPayment = db.prepare(`insert or replace into payments (
    txn_ref, received_at, channel, payer_phone, payer_name, payment_reference, amount
  ) values (?,?,?,?,?,?,?)`);
  const insertPayments = db.transaction(() => {
    let count = 0;
    for (const row of paymentRows.slice(1)) {
      insertPayment.run(
        get(paymentHeaders, row, "txn_ref"),
        normalizeDate(get(paymentHeaders, row, "received_at")),
        get(paymentHeaders, row, "channel"),
        get(paymentHeaders, row, "payer_phone"),
        get(paymentHeaders, row, "payer_name"),
        get(paymentHeaders, row, "payment_reference"),
        toNumber(get(paymentHeaders, row, "amount")),
      );
      count += 1;
    }
    return count;
  })();

  // ---- Contact History ----
  const contactText = await readFile(`${DATA_DIR}/kopano_data.xlsx - Contact History.csv`, "utf-8");
  const contactRows = parseCsv(contactText);
  const contactHeaders = contactRows[0];
  const insertContact = db.prepare(`insert into contact_history (
    date, loan_id, borrower, officer, channel, outcome_notes, promise_date
  ) values (?,?,?,?,?,?,?)`);
  const insertContacts = db.transaction(() => {
    let count = 0;
    for (const row of contactRows.slice(1)) {
      insertContact.run(
        get(contactHeaders, row, "date"),
        get(contactHeaders, row, "loan_id"),
        get(contactHeaders, row, "borrower"),
        get(contactHeaders, row, "officer"),
        get(contactHeaders, row, "channel"),
        get(contactHeaders, row, "outcome_notes"),
        normalizeDate(get(contactHeaders, row, "promise_date")),
      );
      count += 1;
    }
    return count;
  })();

  console.log(
    `Imported ${insertLoans} loans, ${insertPayments} payments, ${insertContacts} contact events into ${DB_PATH}.`,
  );
} finally {
  db.close();
}