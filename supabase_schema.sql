-- =========================================================================
-- DRILL Pro — Database Schema Configuration Script
-- =========================================================================
-- INSTRUCTIONS: Copy and run this script in your Supabase SQL Editor 
-- (https://supabase.com/dashboard/project/_/sql) to set up your tables,
-- indexes, policies, and automatic profile creation trigger.
-- =========================================================================

-- Clean up existing resources if any (use with caution)
-- drop table if exists public.question_bank cascade;
-- drop table if exists public.student_notes cascade;
-- drop table if exists public.learning_materials cascade;
-- drop table if exists public.feature_flags cascade;
-- drop table if exists public.drill_sessions cascade;
-- drop table if exists public.profiles cascade;

-- ==========================================
-- 1. TABLE: feature_flags
-- ==========================================
create table public.feature_flags (
    feature_key text primary key, -- e.g. 'tables', 'tables.range_21_50'
    display_name text not null,
    description text,
    is_free boolean default false not null,
    category text, -- 'drills', 'analytics', 'learning', 'question_bank'
    sort_order integer default 0 not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for feature_flags
alter table public.feature_flags enable row level security;

-- Policies for feature_flags
create policy "Allow read access to feature_flags for all users"
    on public.feature_flags for select
    using (true);

-- ==========================================
-- 2. TABLE: profiles
-- ==========================================
create table public.profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null unique,
    display_name text not null,
    avatar_url text,
    
    -- Aggregate Statistics
    all_time_correct integer default 0 not null,
    all_time_total integer default 0 not null,
    streak integer default 0 not null,
    today_count integer default 0 not null,
    last_active_date text default '',
    
    -- JSONB Columns for Granular Training Metrics
    wrong_counts jsonb default '{}'::jsonb not null,
    table_wrong_counts jsonb default '{}'::jsonb not null,
    detailed_mistakes jsonb default '{"tables": {}, "alpha": {}}'::jsonb not null,
    discipline_metrics jsonb default '{}'::jsonb not null,
    
    -- Subscription
    is_paid boolean default false not null,
    
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Allow users to read their own profile"
    on public.profiles for select
    using (auth.uid() = user_id);

create policy "Allow users to update their own profile"
    on public.profiles for update
    using (auth.uid() = user_id);

create policy "Allow users to insert their own profile"
    on public.profiles for insert
    with check (auth.uid() = user_id);

-- GIN Indexes for fast JSONB querying at scale
create index idx_profiles_detailed_mistakes on public.profiles using gin (detailed_mistakes);
create index idx_profiles_discipline_metrics on public.profiles using gin (discipline_metrics);

-- ==========================================
-- 3. TRIGGER: Auto-create Profile on Sign Up
-- ==========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (user_id, display_name, is_paid)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
        false
    );
    return new;
end;
$$ language plpgsql security definer;

-- Trigger binding
create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- ==========================================
-- 4. TABLE: drill_sessions
-- ==========================================
create table public.drill_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    mode text not null,
    duration_sec integer not null,
    correct integer default 0 not null,
    total integer default 0 not null,
    accuracy numeric(5,2) not null,
    session_log jsonb default '[]'::jsonb not null,
    config jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for drill_sessions
alter table public.drill_sessions enable row level security;

-- Policies for drill_sessions
create policy "Allow users to read their own drill sessions"
    on public.drill_sessions for select
    using (auth.uid() = user_id);

create policy "Allow users to insert their own drill sessions"
    on public.drill_sessions for insert
    with check (auth.uid() = user_id);

-- Index for session queries
create index idx_drill_sessions_user_date on public.drill_sessions (user_id, created_at desc);

-- ==========================================
-- 5. TABLE: learning_materials
-- ==========================================
create table public.learning_materials (
    id uuid primary key default gen_random_uuid(),
    discipline text not null, -- 'tables', 'alpha', 'quant', 'gk', 'english', 'reasoning'
    topic text not null,
    subtopic text,
    title text not null,
    content_md text not null,
    image_urls jsonb default '[]'::jsonb not null,
    video_url text,
    tags jsonb default '[]'::jsonb not null,
    sort_order integer default 0 not null,
    is_published boolean default true not null,
    feature_key text references public.feature_flags(feature_key) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for learning_materials
alter table public.learning_materials enable row level security;

-- Policies for learning_materials
create policy "Allow public read access to published learning materials"
    on public.learning_materials for select
    using (is_published = true);

create index idx_learning_materials_search on public.learning_materials (discipline, topic);

-- ==========================================
-- 6. TABLE: student_notes
-- ==========================================
create table public.student_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    discipline text not null,
    topic text not null,
    title text,
    content_md text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for student_notes
alter table public.student_notes enable row level security;

-- Policies for student_notes
create policy "Allow users to read their own notes"
    on public.student_notes for select
    using (auth.uid() = user_id);

create policy "Allow users to insert their own notes"
    on public.student_notes for insert
    with check (auth.uid() = user_id);

create policy "Allow users to update their own notes"
    on public.student_notes for update
    using (auth.uid() = user_id);

create policy "Allow users to delete their own notes"
    on public.student_notes for delete
    using (auth.uid() = user_id);

create index idx_student_notes_user_disc on public.student_notes (user_id, discipline);

-- ==========================================
-- 7. TABLE: question_bank
-- ==========================================
create table public.question_bank (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    source text not null check (source in ('auto_capture', 'manual')),
    discipline text not null,
    topic text not null,
    question_text text not null,
    correct_answer text not null,
    user_answer text,
    drill_metadata jsonb default '{}'::jsonb not null,
    times_shown integer default 0 not null,
    times_correct integer default 0 not null,
    is_mastered boolean default false not null,
    last_shown_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for question_bank
alter table public.question_bank enable row level security;

-- Policies for question_bank
create policy "Allow users to read their own question bank"
    on public.question_bank for select
    using (auth.uid() = user_id);

create policy "Allow users to insert their own question bank"
    on public.question_bank for insert
    with check (auth.uid() = user_id);

create policy "Allow users to update their own question bank"
    on public.question_bank for update
    using (auth.uid() = user_id);

create policy "Allow users to delete their own question bank"
    on public.question_bank for delete
    using (auth.uid() = user_id);

create index idx_question_bank_user_recs on public.question_bank (user_id, is_mastered, discipline);

-- ==========================================
-- Seed Default Feature Flags
-- ==========================================
insert into public.feature_flags (feature_key, display_name, description, is_free, category, sort_order)
values
    ('tables', 'Tables Practice', 'Access to multiplication table drills', true, 'drills', 1),
    ('tables.range_21_50', 'Tables 21-50', 'Multiplication practice for tables between 21 and 50', false, 'drills', 2),
    ('alpha', 'Alphabet Drills', 'Access to letter-to-number and number-to-letter drills', true, 'drills', 3),
    ('alpha.opposite', 'Opposite Letters', 'Alphabet opposite letter matching practice', false, 'drills', 4),
    ('analytics.detailed', 'Detailed Analytics', 'Breakdown of your exact weak spots and charts', false, 'analytics', 5),
    ('learning.official_content', 'Official Mnemonics & Notes', 'Access to cheat sheets and tricks', true, 'learning', 6),
    ('question_bank', 'Personal Question Bank', 'Ability to manually add and practice your stuck questions', false, 'question_bank', 7)
on conflict (feature_key) do nothing;
