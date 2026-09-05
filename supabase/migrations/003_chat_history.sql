-- Drop unique constraint on user_id in chat_sessions
alter table chat_sessions drop constraint if exists chat_sessions_user_id_key;

-- Add title to chat_sessions
alter table chat_sessions add column if not exists title text;

-- Create chat_messages table
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  ui_data jsonb,
  created_at timestamptz not null default now()
);

-- Index for fetching messages by session quickly
create index if not exists chat_messages_session_id_idx on chat_messages(session_id);
