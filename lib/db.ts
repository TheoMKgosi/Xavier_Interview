import { Pool } from "pg";

export type ConversationStatus = "active" | "awaiting_human" | "in_progress" | "closed";
export type MessageRole = "customer" | "bot" | "staff" | "system";

export interface Conversation {
  id: string;
  status: ConversationStatus;
  handoff_reason: string | null;
  customer_label: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: Date;
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and configure your Neon database.",
    );
  }
  pool = new Pool({ connectionString: url, max: 10 });
  return pool;
}

function rowToConversation(row: Record<string, unknown>): Conversation {
  return {
    id: String(row.id),
    status: row.status as ConversationStatus,
    handoff_reason: row.handoff_reason as string | null,
    customer_label: String(row.customer_label),
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    role: row.role as MessageRole,
    content: String(row.content),
    created_at: row.created_at as Date,
  };
}

export async function createConversation(customerLabel = "Guest"): Promise<Conversation> {
  const { rows } = await getPool().query<Record<string, unknown>>(
    `insert into conversations (customer_label) values ($1)
     returning id, status, handoff_reason, customer_label, created_at, updated_at`,
    [customerLabel],
  );
  return rowToConversation(rows[0]);
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { rows } = await getPool().query<Record<string, unknown>>(
    `select id, status, handoff_reason, customer_label, created_at, updated_at
     from conversations where id = $1`,
    [id],
  );
  return rows.length ? rowToConversation(rows[0]) : null;
}

export async function listConversations(): Promise<Conversation[]> {
  const { rows } = await getPool().query<Record<string, unknown>>(
    `select id, status, handoff_reason, customer_label, created_at, updated_at
     from conversations order by updated_at desc`,
  );
  return rows.map(rowToConversation);
}

export async function addMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
): Promise<Message> {
  const { rows } = await getPool().query<Record<string, unknown>>(
    `insert into messages (conversation_id, role, content) values ($1, $2, $3)
     returning id, conversation_id, role, content, created_at`,
    [conversationId, role, content],
  );
  await getPool().query(
    `update conversations set updated_at = now() where id = $1`,
    [conversationId],
  );
  return rowToMessage(rows[0]);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { rows } = await getPool().query<Record<string, unknown>>(
    `select id, conversation_id, role, content, created_at
     from messages where conversation_id = $1 order by created_at asc`,
    [conversationId],
  );
  return rows.map(rowToMessage);
}

export async function updateConversationStatus(
  id: string,
  status: ConversationStatus,
  handoffReason: string | null = null,
): Promise<void> {
  await getPool().query(
    `update conversations
     set status = $2, handoff_reason = $3, updated_at = now()
     where id = $1`,
    [id, status, handoffReason],
  );
}

export async function setCustomerLabel(id: string, label: string): Promise<void> {
  await getPool().query(
    `update conversations set customer_label = $2, updated_at = now() where id = $1`,
    [id, label],
  );
}