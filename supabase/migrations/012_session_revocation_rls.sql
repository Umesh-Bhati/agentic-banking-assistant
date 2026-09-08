-- Apply API logout revocation to direct Data API reads as well. This schema must
-- remain outside Supabase's exposed API schemas; the helper accepts no caller ID.
begin;
create schema security_private;
revoke all on schema security_private from public, anon, authenticated;
grant usage on schema security_private to authenticated;
create function security_private.active_customer_session() returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  session_claim text := auth.jwt()->>'session_id';
  session_uuid uuid;
begin
  if auth.uid() is null or session_claim is null or
     session_claim !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;
  session_uuid := session_claim::uuid;
  return not exists(select 1 from public.revoked_sessions where session_id=session_uuid);
exception when invalid_text_representation then
  return false;
end $$;
revoke all on function security_private.active_customer_session() from public, anon;
grant execute on function security_private.active_customer_session() to authenticated;
-- Statements are read through the request-scoped client just like accounts.
grant select on public.statement_requests to authenticated;
create policy statements_read on public.statement_requests for select to authenticated
using(user_id=(select auth.uid()) and customer_id in(select id from public.customer_profiles));
-- Restrictive policies AND with existing owner policies; they never independently
-- grant access to privileged-only challenge, audit, and revocation tables.
do $$ declare t text;
begin
  foreach t in array array['customer_profiles','bank_accounts','cards','transactions','customer_products','chat_sessions','chat_messages','pending_actions','statement_requests','action_mfa_challenges','revoked_sessions','security_audit'] loop
    execute format('create policy active_session_read on public.%I as restrictive for select to authenticated using ((select security_private.active_customer_session()))', t);
  end loop;
end $$;
commit;
