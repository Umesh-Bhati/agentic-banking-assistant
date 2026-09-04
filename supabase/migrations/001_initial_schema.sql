-- Enable pgvector extension
create extension if not exists vector with schema public;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create customers table
create table if not exists customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  full_name text not null,
  email text not null,
  phone text not null,
  kyc_status text not null default 'PENDING' check (kyc_status in ('PENDING', 'VERIFIED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create bank_accounts table
create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customer_profiles(id) on delete cascade not null,
  account_number text not null unique,
  balance decimal(15,2) not null default 0,
  currency text not null default 'AED',
  type text not null check (type in ('CURRENT', 'SAVINGS')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DORMANT', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create cards table
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customer_profiles(id) on delete cascade not null,
  last_4 text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'BLOCKED', 'EXPIRED')),
  network text not null check (network in ('VISA', 'MASTERCARD', 'AMEX')),
  card_type text not null,
  expiry_month integer not null,
  expiry_year integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create transactions table
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references bank_accounts(id) on delete cascade not null,
  amount decimal(15,2) not null,
  currency text not null default 'AED',
  type text not null check (type in ('CREDIT', 'DEBIT')),
  category text not null check (category in ('TRANSFER', 'PAYMENT', 'FEE', 'WITHDRAWAL', 'DEPOSIT')),
  description text not null,
  merchant_name text,
  created_at timestamptz not null default now()
);

-- Create chat_sessions table
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  active_workflow_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create bank_documents table for RAG
create table if not exists bank_documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb not null default '{}',
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Create index on embedding for faster similarity search
create index if not exists bank_documents_embedding_idx on bank_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Create index on content for full-text search
create index if not exists bank_documents_content_idx on bank_documents using gin(to_tsvector('english', content));

-- Create function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger update_customer_profiles_updated_at before update on customer_profiles for each row execute function update_updated_at_column();
create trigger update_bank_accounts_updated_at before update on bank_accounts for each row execute function update_updated_at_column();
create trigger update_cards_updated_at before update on cards for each row execute function update_updated_at_column();
create trigger update_chat_sessions_updated_at before update on chat_sessions for each row execute function update_updated_at_column();
