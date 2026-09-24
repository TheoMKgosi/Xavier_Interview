import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";

export type ConversationStatus = "active" | "awaiting_human" | "in_progress" | "closed";
export type MessageRole = "customer" | "bot" | "staff" | "system";

export interface Conversation {
  id: string;
  status: ConversationStatus;
  handoff_reason: string | null;
  customer_label: string;
  verify_step: "none" | "awaiting_otp" | "verified";
  verify_otp: string | null;
  verify_otp_expires_at: string | null;
  verify_phone: string | null;
  verify_last4: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface Loan {
  loan_id: string;
  borrower_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  id_last4: string;
  branch: string;
  loan_officer: string;
  product: string;
  disbursed_on: string | null;
  principal_bwp: number | null;
  term_months: number | null;
  monthly_instalment_bwp: number | null;
  instalments_paid: number | null;
  arrears_bwp: number | null;
  penalties_bwp: number | null;
  outstanding_balance_bwp: number | null;
  next_due_date: string | null;
  days_overdue: number | null;
  status: string | null;
  payment_holiday_used: string | null;
}

export interface Payment {
  txn_ref: string;
  received_at: string | null;
  channel: string | null;
  payer_phone: string | null;
  payer_name: string | null;
  payment_reference: string | null;
  amount: number | null;
}

export interface ContactEvent {
  id: number;
  date: string | null;
  loan_id: string | null;
  borrower: string | null;
  officer: string | null;
  channel: string | null;
  outcome_notes: string | null;
  promise_date: string | null;
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  const path = process.env.DATABASE_URL ?? "data/app.db";
  const dir = path.slice(0, path.lastIndexOf("/"));
  if (dir) {
    mkdirSync(dir, { recursive: true });
  }
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    create table if not exists conversations (
      id text primary key,
      status text not null default 'active'
        check (status in ('active', 'awaiting_human', 'in_progress', 'closed')),
      handoff_reason text,
      customer_label text not null default 'Guest',
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now'))
    );

    create table if not exists messages (
      id text primary key,
      conversation_id text not null references conversations(id) on delete cascade,
      role text not null check (role in ('customer', 'bot', 'staff', 'system')),
      content text not null,
      created_at text not null default (datetime('now'))
    );

    create index if not exists messages_conversation_idx on messages (conversation_id, created_at);
    create index if not exists conversations_updated_idx on conversations (updated_at desc);
    create index if not exists conversations_status_idx on conversations (status);

    create table if not exists loans (
      loan_id text primary key,
      borrower_id text,
      first_name text,
      last_name text,
      phone text,
      id_last4 text,
      branch text,
      loan_officer text,
      product text,
      disbursed_on text,
      principal_bwp real,
      term_months integer,
      monthly_instalment_bwp real,
      instalments_paid integer,
      arrears_bwp real,
      penalties_bwp real,
      outstanding_balance_bwp real,
      next_due_date text,
      days_overdue integer,
      status text,
      payment_holiday_used text
    );

    create index if not exists loans_borrower_idx on loans (borrower_id);
    create index if not exists loans_phone_idx on loans (phone);

    create table if not exists payments (
      txn_ref text primary key,
      received_at text,
      channel text,
      payer_phone text,
      payer_name text,
      payment_reference text,
      amount real
    );

    create index if not exists payments_reference_idx on payments (payment_reference);

    create table if not exists contact_history (
      id integer primary key autoincrement,
      date text,
      loan_id text,
      borrower text,
      officer text,
      channel text,
      outcome_notes text,
      promise_date text
    );

    create index if not exists contact_history_loan_idx on contact_history (loan_id);
  `);

  // Migration: add account-verification columns to existing conversations tables.
  ensureColumn(db, "conversations", "verify_step", "text not null default 'none'");
  ensureColumn(db, "conversations", "verify_otp", "text");
  ensureColumn(db, "conversations", "verify_otp_expires_at", "text");
  ensureColumn(db, "conversations", "verify_phone", "text");
  ensureColumn(db, "conversations", "verify_last4", "text");
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const cols = db.prepare(`pragma table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`alter table ${table} add column ${column} ${definition}`);
  }
}

function newId(): string {
  return crypto.randomUUID();
}

function toConversation(row: Record<string, unknown>): Conversation {
  return {
    id: String(row.id),
    status: row.status as ConversationStatus,
    handoff_reason: row.handoff_reason as string | null,
    customer_label: String(row.customer_label),
    verify_step: (row.verify_step as "none" | "awaiting_otp" | "verified") ?? "none",
    verify_otp: row.verify_otp as string | null,
    verify_otp_expires_at: row.verify_otp_expires_at as string | null,
    verify_phone: row.verify_phone as string | null,
    verify_last4: row.verify_last4 as string | null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function toMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    role: row.role as MessageRole,
    content: String(row.content),
    created_at: String(row.created_at),
  };
}

const CONVERSATION_COLUMNS = `
  id, status, handoff_reason, customer_label,
  verify_step, verify_otp, verify_otp_expires_at, verify_phone, verify_last4,
  created_at, updated_at
`;

export async function createConversation(customerLabel = "Guest"): Promise<Conversation> {
  const id = newId();
  const row = getDb()
    .prepare(
      `insert into conversations (id, customer_label, created_at, updated_at)
       values (?, ?, datetime('now'), datetime('now'))
       returning ${CONVERSATION_COLUMNS}`,
    )
    .get(id, customerLabel) as Record<string, unknown>;
  return toConversation(row);
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const row = getDb()
    .prepare(`select ${CONVERSATION_COLUMNS} from conversations where id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  return row ? toConversation(row) : null;
}

export async function listConversations(): Promise<Conversation[]> {
  const rows = getDb()
    .prepare(`select ${CONVERSATION_COLUMNS} from conversations order by updated_at desc`)
    .all() as Record<string, unknown>[];
  return rows.map(toConversation);
}

export async function addMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
): Promise<Message> {
  const id = newId();
  const run = getDb().transaction(() => {
    const row = getDb()
      .prepare(
        `insert into messages (id, conversation_id, role, content, created_at)
         values (?, ?, ?, ?, datetime('now'))
         returning id, conversation_id, role, content, created_at`,
      )
      .get(id, conversationId, role, content) as Record<string, unknown>;
    getDb()
      .prepare(`update conversations set updated_at = datetime('now') where id = ?`)
      .run(conversationId);
    return row;
  })();
  return toMessage(run);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const rows = getDb()
    .prepare(
      `select id, conversation_id, role, content, created_at
       from messages where conversation_id = ? order by created_at asc`,
    )
    .all(conversationId) as Record<string, unknown>[];
  return rows.map(toMessage);
}

export async function updateConversationStatus(
  id: string,
  status: ConversationStatus,
  handoffReason: string | null = null,
): Promise<void> {
  getDb()
    .prepare(
      `update conversations
       set status = ?, handoff_reason = ?, updated_at = datetime('now')
       where id = ?`,
    )
    .run(status, handoffReason, id);
}

export async function setCustomerLabel(id: string, label: string): Promise<void> {
  getDb()
    .prepare(`update conversations set customer_label = ?, updated_at = datetime('now') where id = ?`)
    .run(label, id);
}

export async function setConversationOtp(
  id: string,
  otp: string,
  expiresAt: string,
  phone: string,
  last4: string,
): Promise<void> {
  getDb()
    .prepare(
      `update conversations
       set verify_step = 'awaiting_otp', verify_otp = ?, verify_otp_expires_at = ?,
           verify_phone = ?, verify_last4 = ?, updated_at = datetime('now')
       where id = ?`,
    )
    .run(otp, expiresAt, phone, last4, id);
}

export async function clearConversationOtp(id: string): Promise<void> {
  getDb()
    .prepare(
      `update conversations
       set verify_step = 'none', verify_otp = null, verify_otp_expires_at = null,
           updated_at = datetime('now')
       where id = ?`,
    )
    .run(id);
}

export async function setConversationVerified(id: string): Promise<void> {
  getDb()
    .prepare(`update conversations set verify_step = 'verified', updated_at = datetime('now') where id = ?`)
    .run(id);
}

/** Normalize a phone number to a comparable digit string (country code stripped). */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00267")) digits = digits.slice(5);
  else if (digits.startsWith("267")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export interface LoanMatch {
  loan: Loan;
  borrowerName: string;
}

export async function findLoanByCredentials(last4: string, phone: string): Promise<LoanMatch | null> {
  const last4Clean = last4.trim();
  const phoneDigits = normalizePhone(phone);
  if (last4Clean.length === 0 || phoneDigits.length === 0) return null;

  const rows = getDb()
    .prepare(
      `select * from loans where id_last4 = ? or phone = ? or replace(phone, ' ', '') = ?`,
    )
    .all(last4Clean, phone, phone.replace(/\s/g, "")) as Record<string, unknown>[];

  const candidates = rows
    .map((r) => ({ loan: toLoan(r), borrowerName: `${String(r.first_name)} ${String(r.last_name)}`.trim() }))
    .filter((c) => {
      const loanPhone = normalizePhone(c.loan.phone ?? "");
      return loanPhone.endsWith(phoneDigits) || phoneDigits.endsWith(loanPhone);
    });

  return candidates.length ? candidates[0] : null;
}

export async function findLoansByCredentials(last4: string, phone: string): Promise<LoanMatch[]> {
  const last4Clean = last4.trim();
  const phoneDigits = normalizePhone(phone);
  if (last4Clean.length === 0 || phoneDigits.length === 0) return [];

  const rows = getDb()
    .prepare(`select * from loans where id_last4 = ?`)
    .all(last4Clean) as Record<string, unknown>[];

  return rows
    .map((r) => ({ loan: toLoan(r), borrowerName: `${String(r.first_name)} ${String(r.last_name)}`.trim() }))
    .filter((c) => {
      const loanPhone = normalizePhone(c.loan.phone ?? "");
      return loanPhone.endsWith(phoneDigits) || phoneDigits.endsWith(loanPhone);
    });
}

function toLoan(row: Record<string, unknown>): Loan {
  return {
    loan_id: String(row.loan_id),
    borrower_id: row.borrower_id as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    phone: row.phone as string,
    id_last4: row.id_last4 as string,
    branch: row.branch as string,
    loan_officer: row.loan_officer as string,
    product: row.product as string,
    disbursed_on: row.disbursed_on as string | null,
    principal_bwp: row.principal_bwp as number | null,
    term_months: row.term_months as number | null,
    monthly_instalment_bwp: row.monthly_instalment_bwp as number | null,
    instalments_paid: row.instalments_paid as number | null,
    arrears_bwp: row.arrears_bwp as number | null,
    penalties_bwp: row.penalties_bwp as number | null,
    outstanding_balance_bwp: row.outstanding_balance_bwp as number | null,
    next_due_date: row.next_due_date as string | null,
    days_overdue: row.days_overdue as number | null,
    status: row.status as string | null,
    payment_holiday_used: row.payment_holiday_used as string | null,
  };
}

export async function getLoanPayments(loanId: string): Promise<Payment[]> {
  const rows = getDb()
    .prepare(`select * from payments where upper(payment_reference) like ? order by received_at desc`)
    .all(`%${loanId.toUpperCase()}%`) as Record<string, unknown>[];
  return rows.map((r) => ({
    txn_ref: String(r.txn_ref),
    received_at: r.received_at as string | null,
    channel: r.channel as string | null,
    payer_phone: r.payer_phone as string | null,
    payer_name: r.payer_name as string | null,
    payment_reference: r.payment_reference as string | null,
    amount: r.amount as number | null,
  }));
}

export async function getLoanContactHistory(loanId: string): Promise<ContactEvent[]> {
  const rows = getDb()
    .prepare(`select * from contact_history where loan_id = ? order by date desc`)
    .all(loanId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: Number(r.id),
    date: r.date as string | null,
    loan_id: r.loan_id as string | null,
    borrower: r.borrower as string | null,
    officer: r.officer as string | null,
    channel: r.channel as string | null,
    outcome_notes: r.outcome_notes as string | null,
    promise_date: r.promise_date as string | null,
  }));
}