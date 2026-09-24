create extension if not exists pgcrypto;

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active'
    check (status in ('active', 'awaiting_human', 'in_progress', 'closed')),
  handoff_reason text,
  customer_label text not null default 'Guest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('customer', 'bot', 'staff', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on messages (conversation_id, created_at);
create index if not exists conversations_updated_idx on conversations (updated_at desc);
create index if not exists conversations_status_idx on conversations (status);