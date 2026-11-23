-- SpeakIT Prototype Database Schema
-- Prototype Scope: Open student access, no authentication, anonymous RLS.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Attempts Table: Tracks every practice turn submitted
create table if not exists public.attempts (
    id uuid primary key default uuid_generate_v4(),
    scenario text not null,
    turn_index integer not null check (turn_index between 0 and 2),
    transcript text not null,
    score integer not null check (score between 0 and 100),
    keywords_used text[] not null default '{}',
    created_at timestamp with time zone default now()
);

-- Index for analytics and streak calculation
create index if not exists idx_attempts_scenario on public.attempts(scenario);
create index if not exists idx_attempts_created_at on public.attempts(created_at desc);

-- 2. Weak Points Table: Aggregates recurring missed keywords and grammar difficulties
create table if not exists public.weak_points (
    id uuid primary key default uuid_generate_v4(),
    kind text not null check (kind in ('keyword', 'grammar')),
    value text not null,
    miss_count integer not null default 1 check (miss_count >= 0),
    updated_at timestamp with time zone default now(),
    constraint uq_weak_points_kind_value unique (kind, value)
);

create index if not exists idx_weak_points_miss_count on public.weak_points(miss_count desc);

-- Row Level Security (RLS) Configuration:
-- Constitution Principle IV: No login, no auth. Prototype allows public insert & select.
alter table public.attempts enable row level security;
alter table public.weak_points enable row level security;

create policy "Allow public read access to attempts"
    on public.attempts for select
    using (true);

create policy "Allow public insert access to attempts"
    on public.attempts for insert
    with check (true);

create policy "Allow public read access to weak_points"
    on public.weak_points for select
    using (true);

create policy "Allow public insert and update access to weak_points"
    on public.weak_points for all
    using (true)
    with check (true);

