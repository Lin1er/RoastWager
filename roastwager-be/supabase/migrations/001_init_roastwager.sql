-- RoastWager initial schema
-- Run in Supabase SQL Editor

begin;

create table if not exists public.posts (
  id text primary key,
  creator text not null,
  content text not null,
  image_url text,
  end_time bigint not null,
  status text not null default 'active' check (status in ('active', 'settled', 'refunded')),
  winning_side smallint check (winning_side in (1, 2) or winning_side is null),
  bull_pool numeric not null default 0,
  bear_pool numeric not null default 0,
  bull_count integer not null default 0,
  bear_count integer not null default 0,
  created_at bigint not null
);

create table if not exists public.wagers (
  id text primary key,
  post_id text not null references public.posts(id) on delete cascade,
  user_address text not null,
  side text not null check (side in ('bull', 'bear')),
  amount numeric not null,
  result text not null default 'pending' check (result in ('pending', 'win', 'lose', 'refund')),
  payout numeric,
  timestamp bigint not null
);

create table if not exists public.users (
  id text primary key,
  level integer not null default 1,
  experience integer not null default 0,
  last_wager_at bigint not null default 0
);

create table if not exists public.sync_state (
  id integer primary key default 1,
  last_processed_block bigint not null default 0,
  check (id = 1)
);

insert into public.sync_state (id, last_processed_block)
values (1, 0)
on conflict (id) do nothing;

create index if not exists idx_posts_status on public.posts(status);
create index if not exists idx_posts_creator on public.posts(creator);
create index if not exists idx_posts_created_at_desc on public.posts(created_at desc);

create index if not exists idx_wagers_post_id on public.wagers(post_id);
create index if not exists idx_wagers_user_address on public.wagers(user_address);
create index if not exists idx_wagers_user_result on public.wagers(user_address, result);

-- Enable tables for Supabase Realtime
alter table public.posts replica identity full;
alter table public.wagers replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'wagers'
  ) then
    alter publication supabase_realtime add table public.wagers;
  end if;
end
$$;

commit;
