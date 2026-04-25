-- Scope indexer state and event keys by contract address
-- Run after 001_init_roastwager.sql

begin;

alter table public.sync_state
  add column if not exists contract_address text;

update public.sync_state
set contract_address = coalesce(contract_address, '')
where id = 1;

create index if not exists idx_posts_id_prefix on public.posts (id text_pattern_ops);
create index if not exists idx_wagers_post_id_prefix on public.wagers (post_id text_pattern_ops);
create index if not exists idx_wagers_id_prefix on public.wagers (id text_pattern_ops);

commit;
