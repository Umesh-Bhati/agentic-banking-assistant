begin;
alter table public.bank_documents add column source_url text, add column content_hash text, add column version_id uuid not null default gen_random_uuid(), add column approval_status text not null default 'STAGED' check(approval_status in('STAGED','APPROVED','RETIRED')),add column retrieved_at timestamptz not null default now(),add column effective_from timestamptz,add column effective_until timestamptz;
create index bank_documents_version on public.bank_documents(version_id);
-- Isolated Data API ingestion principal: allow staged inserts, never approval or banking access.
do $$ begin create role knowledge_ingestor nologin; exception when duplicate_object then null; end $$;
grant knowledge_ingestor to authenticator;
grant usage on schema public to knowledge_ingestor;
grant insert on public.bank_documents to knowledge_ingestor;
create policy knowledge_stage on public.bank_documents for insert to knowledge_ingestor with check(approval_status='STAGED' and source_url like 'https://almasraf.ae/%' and content_hash ~ '^[a-f0-9]{64}$');
create function public.publish_knowledge(p_version_id uuid,p_effective_from timestamptz,p_effective_until timestamptz default null) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source text;
begin
perform pg_advisory_xact_lock(410821);
if p_effective_from is null or (p_effective_until is not null and p_effective_until<=p_effective_from) then
  raise exception 'Invalid effective dates';
end if;
select source_url into source from public.bank_documents where version_id=p_version_id and approval_status='STAGED' limit 1;
if not found or source is null then
  raise exception 'Staged version unavailable';
end if;
if exists(select 1 from public.bank_documents where version_id=p_version_id and (source_url is distinct from source or content_hash is null)) then
  raise exception 'Invalid staged version';
end if;
update public.bank_documents set approval_status='RETIRED' where source_url=source and approval_status='APPROVED';
update public.bank_documents set approval_status='APPROVED',effective_from=p_effective_from,effective_until=p_effective_until where version_id=p_version_id;
end $$;
revoke all on function public.publish_knowledge(uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role;
-- Only a database administrator may publish reviewed public content.
create or replace function public.hybrid_search(query_text text,query_embedding public.vector(1536),match_count int default 10,full_text_weight float default 1.0,semantic_weight float default 1.0,rrf_k int default 50) returns setof public.bank_documents language sql set search_path='public' as $$
with eligible as(select * from public.bank_documents where approval_status='APPROVED' and effective_from<=now() and (effective_until is null or effective_until>now())),
full_text as(select id,row_number() over(order by ts_rank_cd(to_tsvector('english',content),websearch_to_tsquery('english',left(query_text,2000))) desc) rank_ix from eligible where to_tsvector('english',content) @@ websearch_to_tsquery('english',left(query_text,2000)) limit greatest(1,least(match_count,30))*2),
semantic as(select id,row_number() over(order by embedding <=> query_embedding) rank_ix from eligible where embedding is not null limit greatest(1,least(match_count,30))*2)
select d.* from full_text f full outer join semantic s on f.id=s.id join eligible d on d.id=coalesce(f.id,s.id) order by coalesce(1.0/(greatest(rrf_k,1)+f.rank_ix),0)*full_text_weight+coalesce(1.0/(greatest(rrf_k,1)+s.rank_ix),0)*semantic_weight desc limit greatest(1,least(match_count,30))
$$;
revoke all on function public.hybrid_search(text,public.vector,int,float,float,int) from public,anon,authenticated;
grant execute on function public.hybrid_search(text,public.vector,int,float,float,int) to service_role;
commit;
