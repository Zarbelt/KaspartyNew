-- ============================================================
-- Kasparty Forum Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Forum posts
create table if not exists forum_posts (
  id           bigserial primary key,
  category_id  text        not null,
  title        text        not null,
  content      text        not null,
  author_username     text not null,
  author_display_name text not null,
  pinned       boolean     default false,
  tags         text[]      default '{}',
  reply_count  integer     default 0,
  created_at   timestamptz default now(),
  deleted      boolean     default false
);

create index if not exists forum_posts_category_idx on forum_posts(category_id, deleted);
create index if not exists forum_posts_created_idx  on forum_posts(created_at desc);
create index if not exists forum_posts_author_idx   on forum_posts(author_username);

-- Forum replies
create table if not exists forum_replies (
  id           bigserial primary key,
  post_id      bigint      not null references forum_posts(id) on delete cascade,
  content      text        not null,
  author_username     text not null,
  author_display_name text not null,
  created_at   timestamptz default now(),
  deleted      boolean     default false
);

create index if not exists forum_replies_post_idx on forum_replies(post_id, deleted);

-- Moderators (not hardcoded — managed via Mod Panel)
create table if not exists forum_moderators (
  kasmail_username text primary key,
  added_at         timestamptz default now(),
  added_by         text
);

-- Seed initial moderators
insert into forum_moderators (kasmail_username, added_by) values
  ('modmedia', 'system'),
  ('akihiko',  'system')
on conflict (kasmail_username) do nothing;

-- Bans
create table if not exists forum_bans (
  kasmail_username text primary key,
  reason           text,
  banned_by        text        not null,
  banned_at        timestamptz default now(),
  permanent        boolean     default true,
  expires_at       timestamptz
);

-- Timeouts
create table if not exists forum_timeouts (
  kasmail_username text primary key,
  reason           text,
  timeout_by       text        not null,
  timeout_until    timestamptz not null,
  created_at       timestamptz default now()
);

-- ── Row-Level Security ───────────────────────────────────────
alter table forum_posts      enable row level security;
alter table forum_replies     enable row level security;
alter table forum_moderators  enable row level security;
alter table forum_bans        enable row level security;
alter table forum_timeouts    enable row level security;

-- Public read
create policy "public_read_posts"     on forum_posts      for select using (true);
create policy "public_read_replies"   on forum_replies     for select using (true);
create policy "public_read_mods"      on forum_moderators  for select using (true);
create policy "public_read_bans"      on forum_bans        for select using (true);
create policy "public_read_timeouts"  on forum_timeouts    for select using (true);

-- Anon write access (app validates via session on frontend)
create policy "anon_insert_posts"     on forum_posts      for insert with check (true);
create policy "anon_update_posts"     on forum_posts      for update using (true);
create policy "anon_insert_replies"   on forum_replies     for insert with check (true);
create policy "anon_update_replies"   on forum_replies     for update using (true);
create policy "anon_manage_bans"      on forum_bans        for all    using (true);
create policy "anon_manage_timeouts"  on forum_timeouts    for all    using (true);
create policy "anon_manage_mods"      on forum_moderators  for all    using (true);
