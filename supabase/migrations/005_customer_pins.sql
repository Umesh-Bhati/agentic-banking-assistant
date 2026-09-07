-- Add pgcrypto extension for secure PIN hashing
create extension if not exists pgcrypto;

-- Add pin_hash column to customer_profiles
alter table customer_profiles 
  add column if not exists pin_hash text;

-- Seed default PIN '1234' for John Doe demo user
update customer_profiles 
set pin_hash = crypt('1234', gen_salt('bf')) 
where email = 'john.doe@gmail.com';

-- Secure RPC function to check PIN hash without exposing hash to client
create or replace function verify_customer_pin(
  p_customer_id uuid,
  p_pin text
) returns boolean
language plpgsql
security definer
as $$
declare
  v_valid boolean;
begin
  select (pin_hash = crypt(p_pin, pin_hash)) into v_valid
  from customer_profiles
  where id = p_customer_id;

  return coalesce(v_valid, false);
end;
$$;
