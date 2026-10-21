-- ============================================================
-- WordSmart: Supabase Table & Row-Level-Security (RLS) Setup
-- ============================================================
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query).

-- 1. Create the user_progress table
create table if not exists public.user_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique not null,
  covered_ws1 jsonb default '{}'::jsonb not null,
  covered_ws2 jsonb default '{}'::jsonb not null,
  revision_ws1 jsonb default '{}'::jsonb not null,
  revision_ws2 jsonb default '{}'::jsonb not null,
  current_book text default 'ws1' not null,
  index_ws1 integer default 0 not null,
  index_ws2 integer default 0 not null,
  theme text default 'dark' not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- If you already created the table previously, run these two lines to add the revision columns:
alter table public.user_progress add column if not exists revision_ws1 jsonb default '{}'::jsonb not null;
alter table public.user_progress add column if not exists revision_ws2 jsonb default '{}'::jsonb not null;

-- 2. Enable Row Level Security (RLS)
alter table public.user_progress enable row level security;

-- 3. Security Policies: each logged-in user can only read, insert, and update their own row
create policy "Users can view own progress"
  on public.user_progress
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on public.user_progress
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.user_progress
  for update
  using (auth.uid() = user_id);

-- Optional index for faster lookups by user_id
create index if not exists idx_user_progress_user_id on public.user_progress(user_id);
