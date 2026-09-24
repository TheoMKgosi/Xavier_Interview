create table if not exists conversations (
  id text primary key,
  status text not null default 'active'
    check (status in ('active', 'awaiting_human', 'in_progress', 'closed')),
  handoff_reason text,
  customer_label text not null default 'Guest',
  verify_step text not null default 'none'
    check (verify_step in ('none', 'awaiting_otp', 'verified')),
  verify_otp text,
  verify_otp_expires_at text,
  verify_phone text,
  verify_last4 text,
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