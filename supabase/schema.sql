-- Quizr cloud: database setup (accounts, quiz sync, hosted quizzes)
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run again (e.g. after updating the app); it only creates or updates what it needs.

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

-- ===========================================================================
-- Hosted quizzes: a host shares a code, signed-in people take the quiz.
--
-- The host reads and manages their own rows directly. People taking a quiz
-- never read these tables: they go through the hosted_* functions below,
-- which keep time with the server's clock, only send the questions they may
-- see (no answers until they submit), and mark answers on the server.
-- Internal helpers live in the quizr_private schema, which the API can't reach.
-- ===========================================================================
create schema if not exists quizr_private;
revoke all on schema quizr_private from public;

-- Six-character join code without look-alike characters (no 0/O, 1/I/L)
create or replace function public.quizr_new_code()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
    alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    v_code text;
    v_bytes bytea;
begin
    loop
        v_bytes := uuid_send(gen_random_uuid());
        v_code := '';
        for i in 0..5 loop
            v_code := v_code || substr(alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
        end loop;
        exit when not exists (select 1 from public.hosted_quizzes h where h.code = v_code);
    end loop;
    return v_code;
end;
$$;

create table if not exists public.hosted_quizzes (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
    code        text not null unique default public.quizr_new_code(),
    title       text not null check (char_length(title) between 1 and 120),
    quiz_name   text not null default '' check (char_length(quiz_name) <= 200),
    -- Cleaned on save (see quizr_private.clean_hosted_quiz)
    settings    jsonb not null default '{}'::jsonb,
    questions   jsonb not null,
    question_count integer not null default 0,
    total_marks numeric not null default 0,
    is_open     boolean not null default true,
    created_at  timestamptz not null default now()
);

create index if not exists hosted_quizzes_owner_idx on public.hosted_quizzes (owner_id);

create table if not exists public.hosted_attempts (
    id                uuid primary key default gen_random_uuid(),
    quiz_id           uuid not null references public.hosted_quizzes (id) on delete cascade,
    user_id           uuid not null references auth.users (id) on delete cascade,
    name              text not null check (char_length(name) between 1 and 80),
    email             text not null default '',
    status            text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
    question_order    jsonb not null,
    option_order      jsonb not null default '{}'::jsonb,
    answers           jsonb not null default '{}'::jsonb,
    current_index     integer not null default 0,
    view_index        integer not null default 0,
    question_deadline timestamptz,
    deadline          timestamptz,
    started_at        timestamptz not null default now(),
    submitted_at      timestamptz,
    ended_by          text check (ended_by in ('finished', 'ended', 'timeout')),
    results           jsonb,
    score             numeric,
    max_score         numeric,
    pending           integer not null default 0
);

-- The timer and order rules an attempt started with, so editing the quiz doesn't change running attempts
alter table public.hosted_attempts add column if not exists settings jsonb;

create index if not exists hosted_attempts_quiz_idx on public.hosted_attempts (quiz_id);
create index if not exists hosted_attempts_user_idx on public.hosted_attempts (user_id, quiz_id);
-- At most one attempt in progress per person per quiz (guards against double starts)
create unique index if not exists hosted_attempts_one_running on public.hosted_attempts (quiz_id, user_id) where status = 'in_progress';

-- ---------- cleaning what the host saves ----------
create or replace function quizr_private.clean_settings(s jsonb)
returns jsonb language plpgsql immutable as $$
declare
    v_times jsonb := '{}'::jsonb;
    v_type text;
    v_default int;
    v_value numeric;
    v_total numeric;
    v_bool_keys constant text[] := array['groupByCategory', 'shuffleQuestions', 'shuffleOptions', 'showReview', 'allowRetake'];
    v_out jsonb;
    v_key text;
begin
    s := coalesce(s, '{}'::jsonb);
    foreach v_type in array array['mcq', 'true_false', 'theory', 'calculation'] loop
        v_default := case v_type when 'mcq' then 20 when 'true_false' then 10 when 'theory' then 30 else 60 end;
        v_value := case when jsonb_typeof(s->'times'->v_type) = 'number' then (s->'times'->>v_type)::numeric else v_default end;
        v_times := v_times || jsonb_build_object(v_type, greatest(5, least(3600, round(v_value)))::int);
    end loop;
    v_total := case when jsonb_typeof(s->'totalSeconds') = 'number' then (s->>'totalSeconds')::numeric else 600 end;
    v_out := jsonb_build_object(
        'timerMode', case when s->>'timerMode' = 'total' then 'total' else 'question' end,
        'times', v_times,
        'totalSeconds', greatest(30, least(36000, round(v_total)))::int);
    foreach v_key in array v_bool_keys loop
        v_out := v_out || jsonb_build_object(v_key, case
            when jsonb_typeof(s->v_key) = 'boolean' then (s->>v_key)::boolean
            else v_key = 'showReview' end);
    end loop;
    return v_out;
end;
$$;

create or replace function quizr_private.clean_text(v jsonb, max_len int)
returns text language sql immutable as $$
    select left(case jsonb_typeof(v) when 'string' then v #>> '{}' when 'number' then v::text else '' end, max_len)
$$;

create or replace function quizr_private.clean_question(q jsonb)
returns jsonb language plpgsql immutable as $$
declare
    v_type text := q->>'type';
    v_out jsonb;
    v_options jsonb := '{}'::jsonb;
    v_key text;
    v_marks numeric;
    v_category text;
begin
    if jsonb_typeof(q) <> 'object' or v_type is null or v_type not in ('mcq', 'true_false', 'theory', 'calculation') then
        raise exception 'Each question needs a type (multiple choice, true/false, short answer or calculation).';
    end if;
    if coalesce(btrim(q->>'id'), '') = '' then
        raise exception 'Each question needs an ID.';
    end if;
    v_marks := case when jsonb_typeof(q->'marks') = 'number' then (q->>'marks')::numeric
                    when (q->>'marks') ~ '^\s*\d+(\.\d+)?\s*$' then (q->>'marks')::numeric else 0 end;
    v_category := btrim(quizr_private.clean_text(q->'category', 100));
    v_out := jsonb_build_object(
        'id', left(btrim(q->>'id'), 40),
        'type', v_type,
        'category', case when v_category = '' then 'Uncategorised' else v_category end,
        'question', quizr_private.clean_text(q->'question', 20000),
        'marks', greatest(0, least(1000, v_marks)),
        'explanation', quizr_private.clean_text(q->'explanation', 10000));
    if v_type = 'mcq' then
        if jsonb_typeof(q->'options') = 'object' then
            for v_key in select k from jsonb_object_keys(q->'options') k where k ~ '^[A-J]$' loop
                v_options := v_options || jsonb_build_object(v_key, quizr_private.clean_text(q->'options'->v_key, 5000));
            end loop;
        end if;
        if (select count(*) from jsonb_object_keys(v_options)) < 2 then
            raise exception 'Multiple-choice question % needs at least two options.', q->>'id';
        end if;
        v_out := v_out || jsonb_build_object('options', v_options, 'correctAnswer', quizr_private.clean_text(q->'correctAnswer', 10));
    elsif v_type = 'true_false' then
        v_out := v_out || jsonb_build_object('correctAnswer',
            case when lower(q->>'correctAnswer') = 'false' then 'False' else 'True' end);
    else
        v_out := v_out || jsonb_build_object('expectedAnswer',
            quizr_private.clean_text(coalesce(nullif(q->'expectedAnswer', '""'::jsonb), q->'correctAnswer'), 10000));
        if v_type = 'calculation' then
            v_out := v_out || jsonb_build_object('unit', quizr_private.clean_text(q->'unit', 40));
        end if;
    end if;
    return v_out;
end;
$$;

create or replace function quizr_private.clean_hosted_quiz()
returns trigger language plpgsql security definer set search_path = public as $$
declare
    v_questions jsonb;
begin
    new.title := btrim(new.title);
    new.settings := quizr_private.clean_settings(new.settings);
    if tg_op = 'UPDATE' then
        new.owner_id := old.owner_id;
        new.code := old.code;
        new.created_at := old.created_at;
        -- Settings can change at any time (running attempts keep the rules they started with);
        -- questions only until someone has started, so every score is out of the same questions
        if new.questions is not distinct from old.questions then
            return new;
        end if;
        if exists (select 1 from public.hosted_attempts where quiz_id = old.id) then
            raise exception 'People have already started this quiz, so its questions can''t change. Host it again as a new quiz to use different questions.';
        end if;
    end if;
    if jsonb_typeof(new.questions) <> 'array' or jsonb_array_length(new.questions) = 0 then
        raise exception 'Choose at least one question.';
    end if;
    if jsonb_array_length(new.questions) > 500 then
        raise exception 'A hosted quiz can have at most 500 questions.';
    end if;
    if octet_length(new.questions::text) > 3000000 then
        raise exception 'These questions are too large to host. Remove some images or long text and try again.';
    end if;
    select jsonb_agg(quizr_private.clean_question(e) order by n) into v_questions
    from jsonb_array_elements(new.questions) with ordinality as t(e, n);
    if (select count(distinct e->>'id') from jsonb_array_elements(v_questions) e) <> jsonb_array_length(v_questions) then
        raise exception 'Two questions have the same ID.';
    end if;
    new.questions := v_questions;
    new.question_count := jsonb_array_length(v_questions);
    new.total_marks := (select coalesce(sum((e->>'marks')::numeric), 0) from jsonb_array_elements(v_questions) e);
    if tg_op = 'INSERT' then
        new.created_at := now();
        new.is_open := true;
    end if;
    return new;
end;
$$;

drop trigger if exists hosted_quizzes_clean on public.hosted_quizzes;
create trigger hosted_quizzes_clean
    before insert or update on public.hosted_quizzes
    for each row execute function quizr_private.clean_hosted_quiz();

-- ---------- marking ----------
create or replace function quizr_private.strip_html(t text)
returns text language sql immutable as $$
    select replace(replace(replace(replace(replace(replace(
        regexp_replace(regexp_replace(coalesce(t, ''), '<br\s*/?>', ' ', 'gi'), '<[^>]+>', ' ', 'g'),
        '&nbsp;', ' '), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''), '&amp;', '&')
$$;

-- Lower case, no accents, punctuation reduced to single spaces (matches the app's own marking)
create or replace function quizr_private.normalise(t text)
returns text language sql immutable as $$
    select btrim(regexp_replace(regexp_replace(regexp_replace(
        regexp_replace(normalize(lower(quizr_private.strip_html(t)), NFKD), '[̀-ͯ]', '', 'g'),
        '[^[:alnum:].]+', ' ', 'g'),
        '(^|\s)\.+|\.+(\s|$)', ' ', 'g'),
        '\s+', ' ', 'g'))
$$;

-- The last number written in a value ("x = 7" -> 7, "1,500 km" -> 1500), with its decimal places
create or replace function quizr_private.last_number(t text, out val numeric, out decimals int)
language plpgsql immutable as $$
declare
    v_text text;
    v_match text;
begin
    v_text := regexp_replace(quizr_private.strip_html(t), '(\d),(?=\d{3}(\D|$))', '\1', 'g');
    v_text := replace(replace(v_text, '−', '-'), '–', '-');
    select m[1] into v_match
    from regexp_matches(v_text, '(-?\d+(?:\.\d+)?)', 'g') with ordinality as r(m, n)
    order by n desc limit 1;
    if v_match is null then
        val := null; decimals := null;
        return;
    end if;
    val := v_match::numeric;
    decimals := length(split_part(v_match, '.', 2));
end;
$$;

/*
 * Mark one answer. Multiple choice and true/false are exact. Calculation compares
 * numbers (right when it rounds to the expected value at the expected decimal
 * places). Short answers are right when they match the expected text; anything
 * else is left for the host to mark.
 */
create or replace function quizr_private.grade(q jsonb, given text)
returns jsonb language plpgsql immutable as $$
declare
    v_marks numeric := coalesce((q->>'marks')::numeric, 0);
    v_type text := q->>'type';
    v_expected text;
    v_want record;
    v_got record;
    v_right jsonb := jsonb_build_object('status', 'correct', 'awarded', v_marks, 'marks', v_marks);
    v_wrong jsonb := jsonb_build_object('status', 'wrong', 'awarded', 0, 'marks', v_marks);
begin
    if given is null or btrim(given) = '' then
        return jsonb_build_object('status', 'unanswered', 'awarded', 0, 'marks', v_marks);
    end if;
    if v_type = 'mcq' then
        return case when given = q->>'correctAnswer' then v_right else v_wrong end;
    end if;
    if v_type = 'true_false' then
        return case when lower(given) = lower(q->>'correctAnswer') then v_right else v_wrong end;
    end if;
    v_expected := coalesce(q->>'expectedAnswer', '');
    if quizr_private.normalise(v_expected) <> '' and quizr_private.normalise(given) = quizr_private.normalise(v_expected) then
        return v_right;
    end if;
    if v_type = 'calculation' then
        select * into v_want from quizr_private.last_number(v_expected);
        if v_want.val is not null then
            select * into v_got from quizr_private.last_number(given);
            if v_got.val is null then return v_wrong; end if;
            return case when abs(v_got.val - v_want.val) <= 0.5 * power(10::numeric, -v_want.decimals) + 0.000000001
                        then v_right else v_wrong end;
        end if;
    end if;
    return jsonb_build_object('status', 'pending', 'awarded', 0, 'marks', v_marks);
end;
$$;

create or replace function quizr_private.question(p_quiz public.hosted_quizzes, p_id text)
returns jsonb language sql stable as $$
    select e from jsonb_array_elements(p_quiz.questions) e where e->>'id' = p_id limit 1
$$;

create or replace function quizr_private.question_time(p_settings jsonb, p_type text)
returns integer language sql immutable as $$
    select greatest(5, coalesce((p_settings->'times'->>p_type)::int, 30))
$$;

-- The quiz's settings, with the timer and order rules this attempt started with
create or replace function quizr_private.settings_for(p_attempt public.hosted_attempts, p_quiz public.hosted_quizzes)
returns jsonb language sql stable as $$
    select p_quiz.settings || coalesce((
        select jsonb_object_agg(key, value) from jsonb_each(coalesce(p_attempt.settings, '{}'::jsonb))
        where key in ('timerMode', 'times', 'totalSeconds', 'groupByCategory', 'shuffleQuestions', 'shuffleOptions')), '{}'::jsonb)
$$;

-- Mark every answer again, keeping marks the host set by hand
create or replace function quizr_private.rescore(p_attempt uuid)
returns void language plpgsql as $$
declare
    v_a public.hosted_attempts;
    v_q public.hosted_quizzes;
    v_qid text;
    v_question jsonb;
    v_result jsonb;
    v_results jsonb := '{}'::jsonb;
    v_total numeric := 0;
    v_max numeric := 0;
    v_pending int := 0;
begin
    select * into v_a from public.hosted_attempts where id = p_attempt;
    select * into v_q from public.hosted_quizzes where id = v_a.quiz_id;
    for v_qid in select x from jsonb_array_elements_text(v_a.question_order) with ordinality as t(x, n) order by n loop
        v_question := quizr_private.question(v_q, v_qid);
        continue when v_question is null;
        if v_a.results is not null and v_a.results->v_qid->>'status' = 'marked' then
            v_result := v_a.results->v_qid;
        else
            v_result := quizr_private.grade(v_question, v_a.answers->>v_qid);
        end if;
        v_results := v_results || jsonb_build_object(v_qid, v_result);
        v_total := v_total + (v_result->>'awarded')::numeric;
        v_max := v_max + (v_result->>'marks')::numeric;
        if v_result->>'status' = 'pending' then v_pending := v_pending + 1; end if;
    end loop;
    update public.hosted_attempts
       set results = v_results, score = v_total, max_score = v_max, pending = v_pending
     where id = p_attempt;
end;
$$;

create or replace function quizr_private.finish(p_attempt uuid, p_ended_by text, p_at timestamptz)
returns void language plpgsql as $$
begin
    update public.hosted_attempts
       set status = 'submitted',
           ended_by = p_ended_by,
           submitted_at = least(now(), greatest(started_at, p_at)),
           question_deadline = null
     where id = p_attempt and status = 'in_progress';
    perform quizr_private.rescore(p_attempt);
end;
$$;

/*
 * Apply the clock. Per question: each expired question closes and the next one
 * opens with its own time, counted from when the previous one closed (so time
 * keeps running while someone is away). Total time: submit when time is up.
 */
create or replace function quizr_private.tick(p_attempt uuid, p_now timestamptz default now())
returns void language plpgsql as $$
declare
    v_a public.hosted_attempts;
    v_q public.hosted_quizzes;
    v_n int;
    v_changed boolean := false;
    v_settings jsonb;
begin
    select * into v_a from public.hosted_attempts where id = p_attempt for update;
    if not found or v_a.status <> 'in_progress' then return; end if;
    select * into v_q from public.hosted_quizzes where id = v_a.quiz_id;
    v_settings := quizr_private.settings_for(v_a, v_q);
    if v_settings->>'timerMode' = 'total' then
        if p_now >= v_a.deadline then
            perform quizr_private.finish(p_attempt, 'timeout', v_a.deadline);
        end if;
        return;
    end if;
    v_n := jsonb_array_length(v_a.question_order);
    while p_now >= v_a.question_deadline loop
        if v_a.current_index >= v_n - 1 then
            perform quizr_private.finish(p_attempt, 'finished', v_a.question_deadline);
            return;
        end if;
        v_a.current_index := v_a.current_index + 1;
        v_a.question_deadline := v_a.question_deadline + make_interval(secs => quizr_private.question_time(v_settings,
            quizr_private.question(v_q, v_a.question_order->>v_a.current_index)->>'type'));
        v_changed := true;
    end loop;
    if v_changed then
        update public.hosted_attempts
           set current_index = v_a.current_index, view_index = v_a.current_index, question_deadline = v_a.question_deadline
         where id = p_attempt;
    end if;
end;
$$;

create or replace function quizr_private.ms(t timestamptz)
returns bigint language sql immutable as $$
    select (extract(epoch from t) * 1000)::bigint
$$;

create or replace function quizr_private.public_session(p_quiz public.hosted_quizzes)
returns jsonb language sql stable as $$
    select jsonb_build_object(
        'id', p_quiz.id, 'code', p_quiz.code, 'title', p_quiz.title, 'quizName', p_quiz.quiz_name,
        'settings', p_quiz.settings, 'questionCount', p_quiz.question_count, 'totalMarks', p_quiz.total_marks,
        'open', p_quiz.is_open, 'createdAt', quizr_private.ms(p_quiz.created_at))
$$;

-- Everything the person taking the quiz may see right now
create or replace function quizr_private.attempt_state(p_attempt uuid)
returns jsonb language plpgsql stable as $$
declare
    v_a public.hosted_attempts;
    v_q public.hosted_quizzes;
    v_visible jsonb := '{}'::jsonb;
    v_review jsonb;
    v_question jsonb;
    v_qid text;
    v_i int := 0;
    v_total_mode boolean;
    v_running boolean;
begin
    select * into v_a from public.hosted_attempts where id = p_attempt;
    select * into v_q from public.hosted_quizzes where id = v_a.quiz_id;
    v_total_mode := quizr_private.settings_for(v_a, v_q)->>'timerMode' = 'total';
    v_running := v_a.status = 'in_progress';
    for v_qid in select x from jsonb_array_elements_text(v_a.question_order) with ordinality as t(x, n) order by n loop
        -- Per question: questions that haven't opened yet aren't sent
        exit when v_running and not v_total_mode and v_i > v_a.current_index;
        v_question := quizr_private.question(v_q, v_qid);
        if v_question is not null then
            v_visible := v_visible || jsonb_build_object(v_qid, v_question - 'correctAnswer' - 'expectedAnswer' - 'explanation');
        end if;
        v_i := v_i + 1;
    end loop;
    if not v_running and coalesce((v_q.settings->>'showReview')::boolean, true) then
        select jsonb_object_agg(e->>'id', e) into v_review
        from jsonb_array_elements(v_q.questions) e
        where v_a.question_order ? (e->>'id');
    end if;
    return jsonb_build_object(
        'attempt', jsonb_build_object(
            'id', v_a.id, 'sessionId', v_a.quiz_id, 'userId', v_a.user_id, 'name', v_a.name, 'email', v_a.email,
            'status', v_a.status, 'order', v_a.question_order, 'optionOrder', v_a.option_order, 'answers', v_a.answers,
            'current', v_a.current_index, 'view', v_a.view_index,
            'questionDeadline', quizr_private.ms(v_a.question_deadline), 'deadline', quizr_private.ms(v_a.deadline),
            'startedAt', quizr_private.ms(v_a.started_at), 'submittedAt', quizr_private.ms(v_a.submitted_at),
            'endedBy', v_a.ended_by,
            'results', case when v_running then null else v_a.results end,
            'score', v_a.score, 'maxScore', v_a.max_score, 'pending', v_a.pending),
        'session', jsonb_set(quizr_private.public_session(v_q), '{settings}', quizr_private.settings_for(v_a, v_q)),
        'questions', v_visible,
        'review', v_review,
        'serverNow', quizr_private.ms(clock_timestamp()));
end;
$$;

-- The caller's own attempt, locked for changes; errors if it isn't theirs
create or replace function quizr_private.own_attempt(p_attempt uuid)
returns public.hosted_attempts language plpgsql as $$
declare
    v_a public.hosted_attempts;
begin
    if auth.uid() is null then raise exception 'Please sign in first.'; end if;
    select * into v_a from public.hosted_attempts where id = p_attempt and user_id = auth.uid();
    if not found then raise exception 'This attempt no longer exists.'; end if;
    return v_a;
end;
$$;

-- ---------- functions the app calls ----------

-- Look up a quiz by code; also returns the caller's latest attempt at it
create or replace function public.hosted_join(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_q public.hosted_quizzes;
    v_latest uuid;
begin
    if auth.uid() is null then raise exception 'Please sign in first.'; end if;
    select * into v_q from public.hosted_quizzes where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
    if not found then raise exception 'There''s no quiz with that code. Check it and try again.' using errcode = 'P0002'; end if;
    select id into v_latest from public.hosted_attempts
     where quiz_id = v_q.id and user_id = auth.uid() order by started_at desc limit 1;
    if v_latest is not null then perform quizr_private.tick(v_latest); end if;
    return jsonb_build_object(
        'session', quizr_private.public_session(v_q),
        'latest', case when v_latest is null then null else quizr_private.attempt_state(v_latest) end);
end;
$$;

create or replace function public.hosted_start(p_code text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_q public.hosted_quizzes;
    v_uid uuid := auth.uid();
    v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80);
    v_existing uuid;
    v_order jsonb;
    v_options jsonb := '{}'::jsonb;
    v_question jsonb;
    v_first jsonb;
    v_id uuid;
    v_group boolean;
    v_shuffle boolean;
begin
    if v_uid is null then raise exception 'Please sign in first.'; end if;
    if v_name = '' then raise exception 'Please enter your name.'; end if;
    select * into v_q from public.hosted_quizzes where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
    if not found then raise exception 'There''s no quiz with that code. Check it and try again.' using errcode = 'P0002'; end if;

    -- Already running (another tab or device): carry on with it
    select id into v_existing from public.hosted_attempts where quiz_id = v_q.id and user_id = v_uid and status = 'in_progress';
    if v_existing is not null then
        perform quizr_private.tick(v_existing);
        if (select status from public.hosted_attempts where id = v_existing) = 'in_progress' then
            return quizr_private.attempt_state(v_existing);
        end if;
    end if;
    if not v_q.is_open then raise exception 'This quiz is closed.'; end if;
    if not coalesce((v_q.settings->>'allowRetake')::boolean, false)
       and exists (select 1 from public.hosted_attempts where quiz_id = v_q.id and user_id = v_uid and status = 'submitted') then
        raise exception 'You''ve already taken this quiz.';
    end if;

    v_group := coalesce((v_q.settings->>'groupByCategory')::boolean, false);
    v_shuffle := coalesce((v_q.settings->>'shuffleQuestions')::boolean, false);
    select jsonb_agg(e->>'id' order by
               case when v_group then (e->>'category' = 'Uncategorised') end,
               case when v_group then lower(e->>'category') end,
               case when v_shuffle then random() else n end)
      into v_order
      from jsonb_array_elements(v_q.questions) with ordinality as t(e, n);

    for v_question in select e from jsonb_array_elements(v_q.questions) e where e->>'type' = 'mcq' loop
        v_options := v_options || jsonb_build_object(v_question->>'id', (
            select jsonb_agg(k order by case when coalesce((v_q.settings->>'shuffleOptions')::boolean, false) then random() end, k)
            from jsonb_object_keys(v_question->'options') k));
    end loop;

    v_first := quizr_private.question(v_q, v_order->>0);
    begin
        insert into public.hosted_attempts (quiz_id, user_id, name, email, settings, question_order, option_order, question_deadline, deadline)
        values (v_q.id, v_uid, v_name, coalesce((select email from auth.users where id = v_uid), ''), v_q.settings, v_order, v_options,
                case when v_q.settings->>'timerMode' = 'total' then null
                     else now() + make_interval(secs => quizr_private.question_time(v_q.settings, v_first->>'type')) end,
                case when v_q.settings->>'timerMode' = 'total'
                     then now() + make_interval(secs => (v_q.settings->>'totalSeconds')::int) else null end)
        returning id into v_id;
    exception when unique_violation then
        -- Started at the same moment somewhere else
        select id into v_id from public.hosted_attempts where quiz_id = v_q.id and user_id = v_uid and status = 'in_progress';
    end;
    return quizr_private.attempt_state(v_id);
end;
$$;

create or replace function public.hosted_state(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    perform quizr_private.own_attempt(p_attempt);
    perform quizr_private.tick(p_attempt);
    return quizr_private.attempt_state(p_attempt);
end;
$$;

-- Save one answer. A few seconds of grace cover the trip to the server.
create or replace function public.hosted_answer(p_attempt uuid, p_question text, p_value text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_a public.hosted_attempts;
    v_q public.hosted_quizzes;
    v_index int;
    v_saved boolean := false;
begin
    perform quizr_private.own_attempt(p_attempt);
    perform quizr_private.tick(p_attempt, now() - interval '3 seconds');
    select * into v_a from public.hosted_attempts where id = p_attempt for update;
    select * into v_q from public.hosted_quizzes where id = v_a.quiz_id;
    select n - 1 into v_index from jsonb_array_elements_text(v_a.question_order) with ordinality as t(x, n) where x = p_question;
    if v_a.status = 'in_progress' and v_index is not null
       and (quizr_private.settings_for(v_a, v_q)->>'timerMode' = 'total' or v_index = v_a.current_index) then
        update public.hosted_attempts
           set answers = case when p_value is null or p_value = '' then answers - p_question
                              else answers || jsonb_build_object(p_question, left(p_value, 5000)) end
         where id = p_attempt;
        v_saved := true;
    end if;
    perform quizr_private.tick(p_attempt);
    return jsonb_build_object('saved', v_saved, 'state', quizr_private.attempt_state(p_attempt));
end;
$$;

-- Remember which question is on screen (so coming back opens the same one)
create or replace function public.hosted_view(p_attempt uuid, p_index int)
returns void language plpgsql security definer set search_path = public as $$
declare
    v_a public.hosted_attempts;
    v_q public.hosted_quizzes;
begin
    v_a := quizr_private.own_attempt(p_attempt);
    select * into v_q from public.hosted_quizzes where id = v_a.quiz_id;
    update public.hosted_attempts
       set view_index = greatest(0, least(coalesce(p_index, 0),
           case when quizr_private.settings_for(v_a, v_q)->>'timerMode' = 'total' then jsonb_array_length(question_order) - 1 else current_index end))
     where id = p_attempt and status = 'in_progress';
end;
$$;

-- Per question: close the open question (p_from) and open the next, or finish after the last
create or replace function public.hosted_next(p_attempt uuid, p_from int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_a public.hosted_attempts;
    v_q public.hosted_quizzes;
begin
    perform quizr_private.own_attempt(p_attempt);
    perform quizr_private.tick(p_attempt);
    select * into v_a from public.hosted_attempts where id = p_attempt for update;
    select * into v_q from public.hosted_quizzes where id = v_a.quiz_id;
    if v_a.status = 'in_progress' and quizr_private.settings_for(v_a, v_q)->>'timerMode' <> 'total' and v_a.current_index = p_from then
        if v_a.current_index >= jsonb_array_length(v_a.question_order) - 1 then
            perform quizr_private.finish(p_attempt, 'finished', now());
        else
            update public.hosted_attempts
               set current_index = current_index + 1,
                   view_index = current_index + 1,
                   question_deadline = now() + make_interval(secs => quizr_private.question_time(quizr_private.settings_for(v_a, v_q),
                       quizr_private.question(v_q, question_order->>(current_index + 1))->>'type'))
             where id = p_attempt;
        end if;
    end if;
    return quizr_private.attempt_state(p_attempt);
end;
$$;

create or replace function public.hosted_submit(p_attempt uuid, p_ended_by text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    perform quizr_private.own_attempt(p_attempt);
    perform quizr_private.tick(p_attempt);
    if (select status from public.hosted_attempts where id = p_attempt) = 'in_progress' then
        perform quizr_private.finish(p_attempt, case when p_ended_by = 'finished' then 'finished' else 'ended' end, now());
    end if;
    return quizr_private.attempt_state(p_attempt);
end;
$$;

-- Times the person left full screen while taking the quiz, for the host:
-- [{ "at": ms, "back": ms or null, "reason": "left" | "reload" }]
alter table public.hosted_attempts add column if not exists away_events jsonb not null default '[]'::jsonb;

-- Record leaving full screen ('left', or 'reload' when the quiz page was reopened) and coming back ('back')
create or replace function public.hosted_away(p_attempt uuid, p_event text)
returns void language plpgsql security definer set search_path = public as $$
declare
    v_a public.hosted_attempts;
    v_events jsonb;
    v_n int;
    v_open boolean;
begin
    perform quizr_private.own_attempt(p_attempt);
    perform quizr_private.tick(p_attempt);
    select * into v_a from public.hosted_attempts where id = p_attempt for update;
    if v_a.status <> 'in_progress' then return; end if;
    v_events := coalesce(v_a.away_events, '[]'::jsonb);
    v_n := jsonb_array_length(v_events);
    v_open := v_n > 0 and jsonb_typeof(v_events -> (v_n - 1) -> 'back') = 'null';
    if p_event in ('left', 'reload') then
        -- Full screen often ends while a page reloads; the reopened page then says why
        if v_open and p_event = 'reload' then
            v_events := jsonb_set(v_events, array[(v_n - 1)::text, 'reason'], '"reload"'::jsonb);
            update public.hosted_attempts set away_events = v_events where id = p_attempt;
            return;
        end if;
        if v_open or v_n >= 200 then return; end if;
        v_events := v_events || jsonb_build_array(jsonb_build_object(
            'at', quizr_private.ms(now()), 'back', null, 'reason', p_event));
    elsif p_event = 'back' then
        if not v_open then return; end if;
        v_events := jsonb_set(v_events, array[(v_n - 1)::text, 'back'], to_jsonb(quizr_private.ms(now())));
    else
        raise exception 'Unknown event.';
    end if;
    update public.hosted_attempts set away_events = v_events where id = p_attempt;
end;
$$;

-- Host: bring attempts up to date (finish ones whose time has run out)
create or replace function public.hosted_refresh(p_quiz uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
    v_id uuid;
begin
    if not exists (select 1 from public.hosted_quizzes where id = p_quiz and owner_id = auth.uid()) then
        raise exception 'Hosted quiz not found.';
    end if;
    for v_id in select id from public.hosted_attempts where quiz_id = p_quiz and status = 'in_progress' loop
        perform quizr_private.tick(v_id);
    end loop;
end;
$$;

-- Host: set the marks for one answer (null puts back the automatic mark)
create or replace function public.hosted_set_mark(p_attempt uuid, p_question text, p_awarded numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
    v_a public.hosted_attempts;
    v_q public.hosted_quizzes;
    v_question jsonb;
    v_marks numeric;
begin
    select a.* into v_a from public.hosted_attempts a
      join public.hosted_quizzes q on q.id = a.quiz_id
     where a.id = p_attempt and q.owner_id = auth.uid()
       for update of a;
    if not found then raise exception 'Score not found.'; end if;
    if v_a.status <> 'submitted' then raise exception 'Only submitted attempts can be marked.'; end if;
    select * into v_q from public.hosted_quizzes where id = v_a.quiz_id;
    v_question := quizr_private.question(v_q, p_question);
    if v_question is null then raise exception 'Question not found.'; end if;
    v_marks := (v_question->>'marks')::numeric;
    update public.hosted_attempts
       set results = case when p_awarded is null then coalesce(results, '{}'::jsonb) - p_question
                          else coalesce(results, '{}'::jsonb) || jsonb_build_object(p_question, jsonb_build_object(
                               'status', 'marked', 'awarded', greatest(0, least(v_marks, p_awarded)), 'marks', v_marks)) end
     where id = p_attempt;
    perform quizr_private.rescore(p_attempt);
end;
$$;

-- ---------- access ----------
alter table public.hosted_quizzes enable row level security;
alter table public.hosted_attempts enable row level security;

revoke all on public.hosted_quizzes from anon, authenticated;
revoke all on public.hosted_attempts from anon, authenticated;
grant select, delete on public.hosted_quizzes to authenticated;
grant insert (title, quiz_name, settings, questions) on public.hosted_quizzes to authenticated;
grant update (title, quiz_name, is_open, settings, questions) on public.hosted_quizzes to authenticated;
grant select, delete on public.hosted_attempts to authenticated;

drop policy if exists "Hosts read their hosted quizzes" on public.hosted_quizzes;
create policy "Hosts read their hosted quizzes" on public.hosted_quizzes
    for select to authenticated using (owner_id = auth.uid());
drop policy if exists "Hosts create hosted quizzes" on public.hosted_quizzes;
create policy "Hosts create hosted quizzes" on public.hosted_quizzes
    for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "Hosts update their hosted quizzes" on public.hosted_quizzes;
create policy "Hosts update their hosted quizzes" on public.hosted_quizzes
    for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Hosts delete their hosted quizzes" on public.hosted_quizzes;
create policy "Hosts delete their hosted quizzes" on public.hosted_quizzes
    for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "Hosts read attempts at their quizzes" on public.hosted_attempts;
create policy "Hosts read attempts at their quizzes" on public.hosted_attempts
    for select to authenticated
    using (exists (select 1 from public.hosted_quizzes q where q.id = quiz_id and q.owner_id = auth.uid()));
drop policy if exists "Hosts delete attempts at their quizzes" on public.hosted_attempts;
create policy "Hosts delete attempts at their quizzes" on public.hosted_attempts
    for delete to authenticated
    using (exists (select 1 from public.hosted_quizzes q where q.id = quiz_id and q.owner_id = auth.uid()));

-- Functions: only signed-in users, and only the hosted_* entry points
revoke all on all functions in schema quizr_private from public, anon, authenticated;
revoke all on function public.quizr_new_code() from public, anon;
grant execute on function public.quizr_new_code() to authenticated;
revoke all on function public.hosted_join(text) from public, anon;
revoke all on function public.hosted_start(text, text) from public, anon;
revoke all on function public.hosted_state(uuid) from public, anon;
revoke all on function public.hosted_answer(uuid, text, text) from public, anon;
revoke all on function public.hosted_view(uuid, int) from public, anon;
revoke all on function public.hosted_next(uuid, int) from public, anon;
revoke all on function public.hosted_submit(uuid, text) from public, anon;
revoke all on function public.hosted_refresh(uuid) from public, anon;
revoke all on function public.hosted_set_mark(uuid, text, numeric) from public, anon;
revoke all on function public.hosted_away(uuid, text) from public, anon;
grant execute on function public.hosted_join(text) to authenticated;
grant execute on function public.hosted_start(text, text) to authenticated;
grant execute on function public.hosted_state(uuid) to authenticated;
grant execute on function public.hosted_answer(uuid, text, text) to authenticated;
grant execute on function public.hosted_view(uuid, int) to authenticated;
grant execute on function public.hosted_next(uuid, int) to authenticated;
grant execute on function public.hosted_submit(uuid, text) to authenticated;
grant execute on function public.hosted_refresh(uuid) to authenticated;
grant execute on function public.hosted_set_mark(uuid, text, numeric) to authenticated;
grant execute on function public.hosted_away(uuid, text) to authenticated;
