-- Quizr cloud sync: database setup
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run again; it only creates what's missing.

-- ---------------------------------------------------------------------------
-- Quizzes: one row per quiz, holding the whole quiz (questions, teams,
-- history, settings) as JSON so a quiz always uploads/downloads as one unit.
-- ---------------------------------------------------------------------------
create table if not exists public.quizzes (
    id              uuid primary key default gen_random_uuid(),
    owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
    name            text not null check (char_length(name) between 1 and 200),
    data            jsonb not null default '{}'::jsonb,
    -- Bumped on every change; the app uses it to detect edits made on another device
    version         integer not null default 1,
    question_count  integer not null default 0,
    team_count      integer not null default 0,
    updated_device  text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists quizzes_owner_idx on public.quizzes (owner_id);

-- ---------------------------------------------------------------------------
-- Members: who can see or edit a quiz. Today every quiz has exactly one
-- member, its owner (added automatically below). Sharing with co-hosts later
-- only needs extra rows here with role 'editor' or 'viewer'.
-- ---------------------------------------------------------------------------
create table if not exists public.quiz_members (
    quiz_id    uuid not null references public.quizzes (id) on delete cascade,
    user_id    uuid not null references auth.users (id) on delete cascade,
    role       text not null check (role in ('owner', 'editor', 'viewer')),
    created_at timestamptz not null default now(),
    primary key (quiz_id, user_id)
);

create index if not exists quiz_members_user_idx on public.quiz_members (user_id);

-- Keep updated_at current
create or replace function public.quizr_touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists quizzes_touch_updated_at on public.quizzes;
create trigger quizzes_touch_updated_at
    before update on public.quizzes
    for each row execute function public.quizr_touch_updated_at();

-- The owner can never be changed by a client
create or replace function public.quizr_keep_owner()
returns trigger language plpgsql as $$
begin
    new.owner_id := old.owner_id;
    return new;
end;
$$;

drop trigger if exists quizzes_keep_owner on public.quizzes;
create trigger quizzes_keep_owner
    before update on public.quizzes
    for each row execute function public.quizr_keep_owner();

-- Add the owner as a member when a quiz is created
create or replace function public.quizr_add_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.quiz_members (quiz_id, user_id, role)
    values (new.id, new.owner_id, 'owner')
    on conflict do nothing;
    return new;
end;
$$;

drop trigger if exists quizzes_add_owner_member on public.quizzes;
create trigger quizzes_add_owner_member
    after insert on public.quizzes
    for each row execute function public.quizr_add_owner_member();

-- Membership check used by the access rules (security definer avoids
-- the rules on quiz_members checking themselves recursively)
create or replace function public.quizr_has_role(target_quiz uuid, allowed text[])
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.quiz_members
        where quiz_id = target_quiz and user_id = auth.uid() and role = any (allowed)
    );
$$;

-- Signed-in users may use these tables (the policies below decide which rows);
-- visitors who aren't signed in get nothing
grant select, insert, update, delete on public.quizzes to authenticated;
grant select, insert, delete on public.quiz_members to authenticated;
revoke all on public.quizzes from anon;
revoke all on public.quiz_members from anon;
grant execute on function public.quizr_has_role(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: people can only ever reach their own quizzes
-- ---------------------------------------------------------------------------
alter table public.quizzes enable row level security;
alter table public.quiz_members enable row level security;

drop policy if exists "Members can read quizzes" on public.quizzes;
create policy "Members can read quizzes" on public.quizzes
    for select to authenticated
    using (owner_id = auth.uid() or public.quizr_has_role(id, array['owner', 'editor', 'viewer']));

drop policy if exists "Users create their own quizzes" on public.quizzes;
create policy "Users create their own quizzes" on public.quizzes
    for insert to authenticated
    with check (owner_id = auth.uid());

drop policy if exists "Owners and editors update quizzes" on public.quizzes;
create policy "Owners and editors update quizzes" on public.quizzes
    for update to authenticated
    using (owner_id = auth.uid() or public.quizr_has_role(id, array['owner', 'editor']))
    with check (owner_id = auth.uid() or public.quizr_has_role(id, array['owner', 'editor']));

drop policy if exists "Owners delete quizzes" on public.quizzes;
create policy "Owners delete quizzes" on public.quizzes
    for delete to authenticated
    using (owner_id = auth.uid());

drop policy if exists "Members see memberships of their quizzes" on public.quiz_members;
create policy "Members see memberships of their quizzes" on public.quiz_members
    for select to authenticated
    using (user_id = auth.uid() or public.quizr_has_role(quiz_id, array['owner']));

-- Only quiz owners manage members (used once sharing is added)
drop policy if exists "Owners add members" on public.quiz_members;
create policy "Owners add members" on public.quiz_members
    for insert to authenticated
    with check (public.quizr_has_role(quiz_id, array['owner']) and role <> 'owner');

drop policy if exists "Owners remove members" on public.quiz_members;
create policy "Owners remove members" on public.quiz_members
    for delete to authenticated
    using (public.quizr_has_role(quiz_id, array['owner']) and role <> 'owner');
