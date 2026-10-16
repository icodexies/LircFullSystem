-- ============================================================================
-- AI book recommendations per subject + the acquisition list.
--
-- subject_ai_findings caches one AI research run per subject (course code):
-- the findings are stored once, so re-opening a subject is a plain database
-- read — tokens are only spent when a librarian explicitly searches again.
-- The edge function (subject-recommendations) writes the rows with the
-- service role; everything else reads through the RPCs below.
--
-- acquisition_suggestions is the "books to acquire" list:
--   * ai        — added from an AI finding by a librarian
--   * faculty   — a faculty member's suggestion (librarians review it)
--   * librarian — a librarian's own suggestion
-- Librarians and admins review them (approve / reject); the suggester is
-- notified of the decision. The table also carries the course code so the
-- list can be filtered per subject.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.subject_ai_findings (
  id bigint generated always as identity primary key,
  course_code text not null,
  model text,
  web boolean not null default true,
  findings jsonb not null,
  citations jsonb not null default '[]'::jsonb,
  generated_by bigint references public."usersData"(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists subject_ai_findings_code_idx
  on public.subject_ai_findings (course_code, created_at desc);

alter table public.subject_ai_findings enable row level security;
revoke all privileges on table public.subject_ai_findings from public, anon, authenticated;
grant all privileges on table public.subject_ai_findings to service_role;

create table if not exists public.acquisition_suggestions (
  id bigint generated always as identity primary key,
  course_code text,
  title text not null,
  author text,
  note text,
  source text not null check (source in ('ai', 'faculty', 'librarian')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  suggested_by bigint references public."usersData"(id) on delete set null,
  reviewed_by bigint references public."usersData"(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
-- One open request per title (and subject) at a time.
create unique index if not exists acquisition_suggestions_pending_unique
  on public.acquisition_suggestions (lower(title), coalesce(upper(btrim(course_code)), ''))
  where status = 'pending';
create index if not exists acquisition_suggestions_queue_idx
  on public.acquisition_suggestions (status, created_at desc);
create index if not exists acquisition_suggestions_mine_idx
  on public.acquisition_suggestions (suggested_by, created_at desc);

alter table public.acquisition_suggestions enable row level security;
revoke all privileges on table public.acquisition_suggestions from public, anon, authenticated;
grant all privileges on table public.acquisition_suggestions to service_role;

-- ---------------------------------------------------------------------------
-- RPC: the saved AI findings for one subject (library operators)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_ai_findings_get(p_course_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_course_code, '')));
  f public.subject_ai_findings%ROWTYPE;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if v_code = '' then
    raise exception 'Choose a subject.';
  end if;
  select * into f
  from public.subject_ai_findings
  where course_code = v_code
  order by created_at desc, id desc
  limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', f.id,
    'course_code', f.course_code,
    'model', f.model,
    'web', f.web,
    'findings', f.findings,
    'citations', f.citations,
    'generated_at', f.created_at,
    'generated_by_name', (
      select btrim(u.first_name || ' ' || u.surname)
      from public."usersData" u where u.id = f.generated_by));
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: faculty / librarians suggest a book to acquire
-- ---------------------------------------------------------------------------
create or replace function public.lirc_acquisition_suggest(
  p_course_code text, p_title text, p_author text default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me public."usersData"%ROWTYPE;
  v_code text := upper(btrim(coalesce(p_course_code, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_author text := nullif(btrim(coalesce(p_author, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_source text;
  v_id bigint;
  v_name text;
begin
  select * into v_me from public."usersData"
  where id = lirc_private.my_profile_id();
  if not found or lower(btrim(v_me.role::text)) not in ('faculty', 'librarian', 'admin') then
    raise exception 'Only faculty and library staff can suggest books to acquire.'
      using errcode = '42501';
  end if;
  v_source := case when lower(btrim(v_me.role::text)) = 'faculty' then 'faculty' else 'librarian' end;
  if v_title = '' or length(v_title) > 200 then
    raise exception 'Enter the book title (1-200 characters).';
  end if;
  if v_author is not null and length(v_author) > 200 then
    raise exception 'Keep the author under 200 characters.';
  end if;
  if v_note is not null and length(v_note) > 300 then
    raise exception 'Keep the note under 300 characters.';
  end if;
  if v_code <> '' and not exists (
    select 1 from public.curriculum_subjects s
    where upper(btrim(s.course_code)) = v_code) then
    raise exception 'Subject not found in the curriculum.';
  end if;
  if exists (
    select 1 from public.acquisition_suggestions a
    where lower(a.title) = lower(v_title)
      and coalesce(upper(btrim(a.course_code)), '') = v_code
      and a.status = 'pending') then
    raise exception 'This book is already on the acquisition list.';
  end if;
  insert into public.acquisition_suggestions
    (course_code, title, author, note, source, suggested_by)
  values
    (nullif(v_code, ''), v_title, v_author, v_note, v_source, v_me.id)
  returning id into v_id;

  v_name := btrim(v_me.first_name || ' ' || v_me.surname);
  perform lirc_private.notify_library_team(
    'acquisition_suggestion',
    'New book to acquire',
    format('%s suggested "%s"%s for the acquisition list.',
           v_name, v_title,
           case when v_code = '' then '' else ' for ' || v_code end),
    '/path-finder?tab=acquisitions');
  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: a librarian adds an AI finding to the acquisition list
-- ---------------------------------------------------------------------------
create or replace function public.lirc_acquisition_add_from_ai(
  p_course_code text, p_title text, p_author text default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint := lirc_private.library_operator_id();
  v_code text := upper(btrim(coalesce(p_course_code, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_author text := nullif(btrim(coalesce(p_author, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id bigint;
begin
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if v_title = '' or length(v_title) > 200 then
    raise exception 'Enter the book title (1-200 characters).';
  end if;
  if v_author is not null and length(v_author) > 200 then
    raise exception 'Keep the author under 200 characters.';
  end if;
  if v_note is not null and length(v_note) > 300 then
    raise exception 'Keep the note under 300 characters.';
  end if;
  if exists (
    select 1 from public.acquisition_suggestions a
    where lower(a.title) = lower(v_title)
      and coalesce(upper(btrim(a.course_code)), '') = v_code
      and a.status = 'pending') then
    raise exception 'This book is already on the acquisition list.';
  end if;
  insert into public.acquisition_suggestions
    (course_code, title, author, note, source, suggested_by)
  values
    (nullif(v_code, ''), v_title, v_author, v_note, 'ai', v_operator)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: the acquisition list (library operators), by status
-- ---------------------------------------------------------------------------
create or replace function public.lirc_acquisition_list(p_status text default 'pending')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status text := lower(btrim(coalesce(p_status, 'pending')));
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if v_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid status.';
  end if;
  return jsonb_build_object(
    'pending', (
      select count(*) from public.acquisition_suggestions where status = 'pending'),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'course_code', a.course_code,
        'title', a.title,
        'author', a.author,
        'note', a.note,
        'source', a.source,
        'status', a.status,
        'created_at', a.created_at,
        'reviewed_at', a.reviewed_at,
        'review_note', a.review_note,
        'suggested_by_name', (
          select btrim(u.first_name || ' ' || u.surname)
          from public."usersData" u where u.id = a.suggested_by),
        'reviewed_by_name', (
          select btrim(u.first_name || ' ' || u.surname)
          from public."usersData" u where u.id = a.reviewed_by))
        order by a.created_at desc)
      from public.acquisition_suggestions a
      where a.status = v_status), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: faculty's own acquisition suggestions
-- ---------------------------------------------------------------------------
create or replace function public.lirc_my_acquisitions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me public."usersData"%ROWTYPE;
begin
  select * into v_me from public."usersData"
  where id = lirc_private.my_profile_id();
  if not found or lower(btrim(v_me.role::text)) <> 'faculty' then
    raise exception 'Faculty access required.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'course_code', a.course_code,
      'title', a.title,
      'author', a.author,
      'note', a.note,
      'status', a.status,
      'created_at', a.created_at,
      'reviewed_at', a.reviewed_at,
      'review_note', a.review_note,
      'reviewed_by_name', (
        select btrim(u.first_name || ' ' || u.surname)
        from public."usersData" u where u.id = a.reviewed_by))
      order by a.created_at desc)
    from public.acquisition_suggestions a
    where a.suggested_by = v_me.id), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: review an acquisition suggestion (library operators)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_acquisition_review(
  p_suggestion_id bigint, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint := lirc_private.library_operator_id();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  a public.acquisition_suggestions%ROWTYPE;
begin
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if v_note is not null and length(v_note) > 300 then
    raise exception 'Keep the note under 300 characters.';
  end if;
  select * into a from public.acquisition_suggestions
  where id = p_suggestion_id for update;
  if not found then
    raise exception 'Suggestion not found.';
  end if;
  if a.status <> 'pending' then
    raise exception 'This suggestion was already reviewed.';
  end if;
  update public.acquisition_suggestions
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = v_operator,
         reviewed_at = now(),
         review_note = v_note
   where id = p_suggestion_id;
  if a.suggested_by is not null and a.suggested_by <> v_operator then
    perform lirc_private.notify_profile(
      a.suggested_by,
      case when p_approve then 'acquisition_approved' else 'acquisition_rejected' end,
      case when p_approve then 'Book to acquire approved' else 'Book to acquire not added' end,
      case when p_approve
        then format('"%s" was approved for acquisition.', a.title)
        else format('"%s" was not added to the acquisition list.%s', a.title,
                    case when v_note is null then '' else ' Note: ' || v_note end)
      end,
      '/path-finder?tab=acquisitions');
  end if;
  return jsonb_build_object(
    'id', p_suggestion_id,
    'status', case when p_approve then 'approved' else 'rejected' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: faculty withdraws their own pending suggestion
-- ---------------------------------------------------------------------------
create or replace function public.lirc_acquisition_withdraw(p_suggestion_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
begin
  if v_me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  delete from public.acquisition_suggestions
  where id = p_suggestion_id
    and suggested_by = v_me
    and status = 'pending';
  if not found then
    raise exception 'Only your own pending suggestion can be withdrawn.';
  end if;
  return jsonb_build_object('withdrawn', p_suggestion_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.lirc_ai_findings_get(text) from public, anon, authenticated;
revoke all on function public.lirc_acquisition_suggest(text, text, text, text) from public, anon, authenticated;
revoke all on function public.lirc_acquisition_add_from_ai(text, text, text, text) from public, anon, authenticated;
revoke all on function public.lirc_acquisition_list(text) from public, anon, authenticated;
revoke all on function public.lirc_my_acquisitions() from public, anon, authenticated;
revoke all on function public.lirc_acquisition_review(bigint, boolean, text) from public, anon, authenticated;
revoke all on function public.lirc_acquisition_withdraw(bigint) from public, anon, authenticated;

grant execute on function public.lirc_ai_findings_get(text),
  public.lirc_acquisition_suggest(text, text, text, text),
  public.lirc_acquisition_add_from_ai(text, text, text, text),
  public.lirc_acquisition_list(text),
  public.lirc_my_acquisitions(),
  public.lirc_acquisition_review(bigint, boolean, text),
  public.lirc_acquisition_withdraw(bigint)
  to authenticated;

commit;
