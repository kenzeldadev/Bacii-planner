-- Run this in Supabase Dashboard → SQL Editor.

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  sort_order int default 0
);

create table if not exists chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects(id) on delete cascade,
  name text not null,
  sort_order int default 0
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references chapters(id) on delete cascade,
  title text not null,
  done boolean default false,
  done_at timestamptz,
  confidence integer check (confidence between 1 and 3),
  sort_order int default 0
);

alter table lessons
  add column if not exists confidence integer check (confidence between 1 and 3);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references chapters(id) on delete cascade,
  author_email text not null,
  content text not null,
  created_at timestamptz default now()
);

-- Row Level Security: any logged-in user can read, add, update, and delete everything.
alter table subjects enable row level security;
alter table chapters enable row level security;
alter table lessons  enable row level security;
alter table notes    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['subjects','chapters','lessons','notes'] loop
    execute format('drop policy if exists "auth select" on %I', t);
    execute format('drop policy if exists "auth insert" on %I', t);
    execute format('drop policy if exists "auth update" on %I', t);
    execute format('drop policy if exists "auth delete" on %I', t);
    execute format('create policy "auth select" on %I for select to authenticated using (true)', t);
    execute format('create policy "auth insert" on %I for insert to authenticated with check (true)', t);
    execute format('create policy "auth update" on %I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "auth delete" on %I for delete to authenticated using (true)', t);
  end loop;
end $$;

create table if not exists tree_layouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  node_positions jsonb not null default '{}'::jsonb
);

alter table tree_layouts enable row level security;

drop policy if exists "users read own tree layout" on tree_layouts;
drop policy if exists "users insert own tree layout" on tree_layouts;
drop policy if exists "users update own tree layout" on tree_layouts;

create policy "users read own tree layout"
  on tree_layouts for select to authenticated
  using (auth.uid() = user_id);

create policy "users insert own tree layout"
  on tree_layouts for insert to authenticated
  with check (auth.uid() = user_id);

create policy "users update own tree layout"
  on tree_layouts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
