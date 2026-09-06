-- Create pending_actions table
create table if not exists pending_actions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  customer_id uuid references customer_profiles(id) on delete cascade not null,
  action_type text not null,
  status text not null default 'CREATED' 
    check (status in ('CREATED','PENDING_SELECTION','PENDING_CONFIRMATION',
                      'PENDING_AUTHORIZATION','AUTHORIZED','PROCESSING',
                      'COMPLETED','FAILED','CANCELLED','EXPIRED')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pending_actions_user_id_idx on pending_actions(user_id);
create index if not exists pending_actions_status_idx on pending_actions(status);

create trigger update_pending_actions_updated_at 
  before update on pending_actions 
  for each row execute function update_updated_at_column();
