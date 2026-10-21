-- ============================================================================
-- Path Finder — General Education option
--
-- Gen Ed subjects are taught in several programs under different course codes
-- (for example Readings in Philippine History is RPH201, RPH202 or RPH301).
-- A new group table ties those rows together:
--
--   gen_ed_subjects                 one row per Gen Ed subject (from the
--                                   library's Gen Ed curriculum list)
--   curriculum_subjects.gen_ed_subject_id
--                                   which Gen Ed group a subject row belongs to
--   subject_recommendations.gen_ed_subject_id
--                                   a book added once for the whole group
--
-- A recommendation added on any subject of a group (or in the new General
-- Education view) is shown on every program's subject of that group:
--
--   lirc_path_finder_gen_ed()       the new General Education list
--   lirc_path_finder_curriculum()   now includes group recommendations
--   lirc_path_finder_add_recommendation() / …_suggest()
--                                   accept p_gen_ed_subject_id and map a
--                                   program subject code to its group
--
-- The Gen Ed categories without a matching subject in the current curriculum
-- (Filipino, research methods, society & culture, Philippine government) are
-- not created here.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Gen Ed subjects
-- ---------------------------------------------------------------------------
create table if not exists public.gen_ed_subjects (
  id bigint generated always as identity primary key,
  key text not null unique,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.gen_ed_subjects enable row level security;
revoke all privileges on table public.gen_ed_subjects from public, anon, authenticated;
grant all privileges on table public.gen_ed_subjects to service_role;

insert into public.gen_ed_subjects (key, label, sort_order) values
  ('understanding-the-self', 'Understanding the Self', 1),
  ('readings-philippine-history', 'Readings in Philippine History', 2),
  ('contemporary-world', 'The Contemporary World', 3),
  ('mathematics-modern-world', 'Mathematics in the Modern World', 4),
  ('interactive-english', 'Interactive English', 5),
  ('english-specific-purposes', 'English for Specific Purposes', 6),
  ('purposive-communication', 'Purposive Communication', 7),
  ('art-appreciation', 'Art Appreciation', 8),
  ('science-technology-society', 'Science, Technology and Society', 9),
  ('ethics', 'Ethics', 10),
  ('entrepreneurial-mind', 'The Entrepreneurial Mind', 11),
  ('global-citizenship', 'Global Citizenship Education', 12),
  ('rizal', 'The Life and Works of Rizal', 13),
  ('living-it-era', 'Living in the IT Era', 14),
  ('gender-society', 'Gender and Society', 15),
  ('pe-1', 'Physical Education 1', 16),
  ('pe-2', 'Physical Education 2', 17),
  ('pe-3', 'Physical Education 3', 18),
  ('pe-4', 'Physical Education 4', 19),
  ('nstp-1', 'NSTP 1', 20),
  ('nstp-2', 'NSTP 2', 21)
on conflict (key) do update set label = excluded.label, sort_order = excluded.sort_order;

alter table public.curriculum_subjects
  add column if not exists gen_ed_subject_id bigint
  references public.gen_ed_subjects(id) on delete set null;
create index if not exists curriculum_subjects_gen_ed_idx
  on public.curriculum_subjects (gen_ed_subject_id);

alter table public.subject_recommendations
  add column if not exists gen_ed_subject_id bigint
  references public.gen_ed_subjects(id) on delete cascade;
create index if not exists subject_recommendations_gen_ed_idx
  on public.subject_recommendations (gen_ed_subject_id, status);

-- ---------------------------------------------------------------------------
-- 2. Map the current curriculum subjects to their Gen Ed group
-- ---------------------------------------------------------------------------
update public.curriculum_subjects s
set gen_ed_subject_id = ge.id
from public.gen_ed_subjects ge
join (values
  ('US101', 'understanding-the-self'),
  ('RPH201', 'readings-philippine-history'),
  ('RPH202', 'readings-philippine-history'),
  ('RPH301', 'readings-philippine-history'),
  ('TCW101', 'contemporary-world'),
  ('TCW201', 'contemporary-world'),
  ('MATH101', 'mathematics-modern-world'),
  ('MMW101', 'mathematics-modern-world'),
  ('MMW102', 'mathematics-modern-world'),
  ('IE101', 'interactive-english'),
  ('ESP201', 'english-specific-purposes'),
  ('PCOM101', 'purposive-communication'),
  ('PCOM102', 'purposive-communication'),
  ('ARTAP201', 'art-appreciation'),
  ('SOC202', 'science-technology-society'),
  ('STS201', 'science-technology-society'),
  ('STS202', 'science-technology-society'),
  ('ETHICS202', 'ethics'),
  ('TEM201', 'entrepreneurial-mind'),
  ('RIZAL102', 'rizal'),
  ('RIZAL201', 'rizal'),
  ('RIZAL301', 'rizal'),
  ('RIZAL302', 'rizal'),
  ('ITE101', 'living-it-era'),
  ('EL102', 'gender-society'),
  ('GAD102', 'gender-society'),
  ('PATHFIT1', 'pe-1'),
  ('PATHFIT2', 'pe-2'),
  ('PATHFIT3', 'pe-3'),
  ('PATHFIT4', 'pe-4'),
  ('NSTP101', 'nstp-1'),
  ('NSTP102', 'nstp-2')
) as m(code, key) on m.key = ge.key
where upper(btrim(s.course_code)) = m.code;

-- General Ethics under the shared ETHICS302 code (Professional Ethics stays
-- out of the Gen Ed group).
update public.curriculum_subjects s
set gen_ed_subject_id = ge.id
from public.gen_ed_subjects ge
where ge.key = 'ethics'
  and upper(btrim(s.course_code)) = 'ETHICS302'
  and lower(btrim(s.course_title)) = 'general ethics';

update public.curriculum_subjects s
set gen_ed_subject_id = ge.id
from public.gen_ed_subjects ge
where ge.key = 'global-citizenship'
  and (upper(btrim(s.course_code)) like 'GCE%'
       or upper(btrim(s.course_code)) like 'GCED%');

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
create or replace function lirc_private.gen_ed_codes(p_gen_ed_id bigint)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct upper(btrim(s.course_code))), '{}'::text[])
  from public.curriculum_subjects s
  where s.gen_ed_subject_id = p_gen_ed_id;
$$;
revoke all on function lirc_private.gen_ed_codes(bigint)
  from public, anon, authenticated;

create or replace function lirc_private.gen_ed_primary_code(p_gen_ed_id bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select code
  from (
    select upper(btrim(s.course_code)) as code, count(*) as uses
    from public.curriculum_subjects s
    where s.gen_ed_subject_id = p_gen_ed_id
    group by 1
  ) q
  order by uses desc, code
  limit 1;
$$;
revoke all on function lirc_private.gen_ed_primary_code(bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC: the General Education list (member-visible)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_path_finder_gen_ed()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_faculty bigint := lirc_private.path_finder_faculty_id();
  v_curator bigint := lirc_private.path_finder_curator_id();
  result jsonb;
begin
  select jsonb_build_object(
    'groups', coalesce(jsonb_agg(x.group_json order by x.sort_order, x.label), '[]'::jsonb))
  into result
  from (
    select ge.sort_order, ge.label,
      jsonb_build_object(
        'id', ge.id,
        'course_code', coalesce(lirc_private.gen_ed_primary_code(ge.id), 'GEN ED'),
        'course_title', ge.label,
        'is_general_education', true,
        'program_count', (
          select count(distinct e.curriculum_program_id)
          from public.curriculum_subjects s
          join public.curriculum_entries e on e.subject_id = s.id
          where s.gen_ed_subject_id = ge.id),
        'codes', to_jsonb(lirc_private.gen_ed_codes(ge.id)),
        'books', coalesce((
          select jsonb_agg(rr.row_json order by rr.created_at)
          from (
            select distinct on (r.book_id)
              lirc_private.path_finder_book_json(r.book_id)
                || jsonb_build_object(
                     'recommendation_id', r.id,
                     'source', r.source,
                     'note', r.note) as row_json,
              r.created_at
            from public.subject_recommendations r
            where r.status = 'approved'
              and (
                r.gen_ed_subject_id = ge.id
                or r.course_code = any(lirc_private.gen_ed_codes(ge.id)))
            order by r.book_id,
                     (r.gen_ed_subject_id = ge.id) desc,
                     r.created_at
          ) rr), '[]'::jsonb),
        'my_pending', case when v_faculty is null then null else (
          select jsonb_build_object(
            'recommendation_id', r.id,
            'book_name', b.book_name,
            'created_at', r.created_at)
          from public.subject_recommendations r
          join public.books b on b.id = r.book_id
          where r.recommended_by = v_faculty
            and r.status = 'pending'
            and (
              r.gen_ed_subject_id = ge.id
              or r.course_code = any(lirc_private.gen_ed_codes(ge.id)))
          order by r.created_at
          limit 1) end,
        'pending_count', case when v_curator is null then 0 else (
          select count(*)
          from public.subject_recommendations r
          where r.status = 'pending'
            and (
              r.gen_ed_subject_id = ge.id
              or r.course_code = any(lirc_private.gen_ed_codes(ge.id)))) end
      ) as group_json
    from public.gen_ed_subjects ge
  ) x;
  return result;
end $$;

revoke all on function public.lirc_path_finder_gen_ed() from public, anon;
grant execute on function public.lirc_path_finder_gen_ed() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Curriculum RPC: Gen Ed books appear on every program's subject
-- ---------------------------------------------------------------------------
create or replace function public.lirc_path_finder_curriculum(p_program_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_faculty bigint := lirc_private.path_finder_faculty_id();
  v_curator bigint := lirc_private.path_finder_curator_id();
  v_program jsonb;
  v_years jsonb;
begin
  select jsonb_build_object(
    'id', cp.id, 'code', cp.code, 'name', cp.name,
    'department', cp.department, 'director', cp.director,
    'total_units', cp.total_units, 'library_program', p.name)
  into v_program
  from public.curriculum_programs cp
  left join public.programs p on p.id = cp.program_id
  where cp.id = p_program_id;
  if v_program is null then
    raise exception 'Program not found.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'year_level', y.year_level,
      'semesters', y.semesters
    ) order by y.year_level), '[]'::jsonb)
  into v_years
  from (
    select ey.year_level,
           jsonb_agg(jsonb_build_object('semester', ey.semester, 'subjects', ey.subjects)
                     order by ey.semester) as semesters
    from (
      select e.year_level, e.semester,
             jsonb_agg(jsonb_build_object(
               'entry_id', e.id,
               'subject_id', s.id,
               'course_code', s.course_code,
               'course_title', s.course_title,
               'gen_ed_subject_id', s.gen_ed_subject_id,
               'is_general_education', s.gen_ed_subject_id is not null,
               'units', e.units,
               'lec_hours', e.lec_hours,
               'lab_hours', e.lab_hours,
               'prerequisites', e.prerequisites,
               'remarks', e.remarks,
               'books', coalesce((
                 select jsonb_agg(rr.row_json order by rr.created_at)
                 from (
                   select distinct on (r.book_id)
                     lirc_private.path_finder_book_json(r.book_id)
                       || jsonb_build_object(
                            'recommendation_id', r.id,
                            'source', r.source,
                            'note', r.note) as row_json,
                     r.created_at
                   from public.subject_recommendations r
                   where r.status = 'approved'
                     and (
                       r.course_code = upper(btrim(s.course_code))
                       or (s.gen_ed_subject_id is not null
                           and (
                             r.gen_ed_subject_id = s.gen_ed_subject_id
                             or r.course_code = any(lirc_private.gen_ed_codes(s.gen_ed_subject_id)))))
                   order by r.book_id,
                            (r.gen_ed_subject_id = s.gen_ed_subject_id) desc,
                            r.created_at
                 ) rr
               ), '[]'::jsonb),
               'my_pending', case when v_faculty is null then null else (
                 select jsonb_build_object(
                   'recommendation_id', r.id,
                   'book_name', b.book_name,
                   'created_at', r.created_at)
                 from public.subject_recommendations r
                 join public.books b on b.id = r.book_id
                 where r.recommended_by = v_faculty
                   and r.status = 'pending'
                   and (
                     r.course_code = upper(btrim(s.course_code))
                     or (s.gen_ed_subject_id is not null
                         and (
                           r.gen_ed_subject_id = s.gen_ed_subject_id
                           or r.course_code = any(lirc_private.gen_ed_codes(s.gen_ed_subject_id)))))
                 order by r.created_at limit 1) end,
               'pending_count', case when v_curator is null then 0 else (
                 select count(*) from public.subject_recommendations r
                 where r.status = 'pending'
                   and (
                     r.course_code = upper(btrim(s.course_code))
                     or (s.gen_ed_subject_id is not null
                         and (
                           r.gen_ed_subject_id = s.gen_ed_subject_id
                           or r.course_code = any(lirc_private.gen_ed_codes(s.gen_ed_subject_id)))))) end
             ) order by s.course_code) as subjects
      from public.curriculum_entries e
      join public.curriculum_subjects s on s.id = e.subject_id
      where e.curriculum_program_id = p_program_id
      group by e.year_level, e.semester
    ) ey
    group by ey.year_level
  ) y;

  return jsonb_build_object('program', v_program, 'years', v_years);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Add / suggest: one list per Gen Ed group
--    (the old 3-argument functions are replaced by 4-argument ones with a
--     default, so drop them first)
-- ---------------------------------------------------------------------------
drop function if exists public.lirc_path_finder_add_recommendation(text,bigint,text);
drop function if exists public.lirc_path_finder_suggest(text,bigint,text);

create or replace function public.lirc_path_finder_add_recommendation(
  p_course_code text,
  p_book_id bigint,
  p_note text default null,
  p_gen_ed_subject_id bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curator bigint := lirc_private.path_finder_curator_id();
  v_code text := upper(btrim(coalesce(p_course_code, '')));
  v_group bigint := p_gen_ed_subject_id;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id bigint;
begin
  if v_curator is null then
    raise exception 'Library staff access required.' using errcode = '42501';
  end if;

  if v_group is not null then
    if not exists (select 1 from public.gen_ed_subjects g where g.id = v_group) then
      raise exception 'General education subject not found.';
    end if;
    if v_code = '' then
      v_code := lirc_private.gen_ed_primary_code(v_group);
    end if;
  else
    select s.gen_ed_subject_id into v_group
    from public.curriculum_subjects s
    where upper(btrim(s.course_code)) = v_code
      and s.gen_ed_subject_id is not null
    limit 1;
    if not exists (
      select 1 from public.curriculum_subjects s
      where upper(btrim(s.course_code)) = v_code
    ) then
      raise exception 'Subject not found in the curriculum.';
    end if;
  end if;

  if v_code = '' or v_code is null then
    raise exception 'Choose a subject.';
  end if;
  if not exists (select 1 from public.books b where b.id = p_book_id) then
    raise exception 'Book not found in the catalog.';
  end if;
  if v_note is not null and length(v_note) > 300 then
    raise exception 'Keep the note under 300 characters.';
  end if;
  if exists (
    select 1 from public.subject_recommendations r
    where r.book_id = p_book_id
      and r.status in ('pending', 'approved')
      and (
        (v_group is not null
         and (r.gen_ed_subject_id = v_group
              or r.course_code = any(lirc_private.gen_ed_codes(v_group))))
        or (v_group is null and r.course_code = v_code))
  ) then
    raise exception 'This book is already on the subject''s list.';
  end if;

  insert into public.subject_recommendations
    (course_code, gen_ed_subject_id, book_id, source, note, status,
     recommended_by, reviewed_by, reviewed_at)
  values
    (v_code, v_group, p_book_id, 'librarian', v_note, 'approved',
     v_curator, v_curator, now())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'approved');
end $$;

create or replace function public.lirc_path_finder_suggest(
  p_course_code text,
  p_book_id bigint,
  p_note text default null,
  p_gen_ed_subject_id bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_faculty bigint := lirc_private.path_finder_faculty_id();
  v_code text := upper(btrim(coalesce(p_course_code, '')));
  v_group bigint := p_gen_ed_subject_id;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id bigint;
  v_name text;
  v_book text;
  v_label text;
begin
  if v_faculty is null then
    raise exception 'Only faculty accounts can suggest books.' using errcode = '42501';
  end if;

  if v_group is not null then
    if not exists (select 1 from public.gen_ed_subjects g where g.id = v_group) then
      raise exception 'General education subject not found.';
    end if;
    if v_code = '' then
      v_code := lirc_private.gen_ed_primary_code(v_group);
    end if;
  else
    select s.gen_ed_subject_id into v_group
    from public.curriculum_subjects s
    where upper(btrim(s.course_code)) = v_code
      and s.gen_ed_subject_id is not null
    limit 1;
    if not exists (
      select 1 from public.curriculum_subjects s
      where upper(btrim(s.course_code)) = v_code
    ) then
      raise exception 'Subject not found in the curriculum.';
    end if;
  end if;

  if v_code = '' or v_code is null then
    raise exception 'Choose a subject.';
  end if;
  select b.book_name into v_book from public.books b where b.id = p_book_id;
  if v_book is null then
    raise exception 'Book not found in the catalog.';
  end if;
  if v_note is not null and length(v_note) > 300 then
    raise exception 'Keep the note under 300 characters.';
  end if;
  if exists (
    select 1 from public.subject_recommendations r
    where r.book_id = p_book_id
      and r.status in ('pending', 'approved')
      and (
        (v_group is not null
         and (r.gen_ed_subject_id = v_group
              or r.course_code = any(lirc_private.gen_ed_codes(v_group))))
        or (v_group is null and r.course_code = v_code))
  ) then
    raise exception 'This book is already on the subject''s list.';
  end if;

  insert into public.subject_recommendations
    (course_code, gen_ed_subject_id, book_id, source, note, status, recommended_by)
  values
    (v_code, v_group, p_book_id, 'faculty', v_note, 'pending', v_faculty)
  returning id into v_id;

  select btrim(u.first_name || ' ' || u.surname) into v_name
  from public."usersData" u where u.id = v_faculty;
  v_label := coalesce(
    (select g.label from public.gen_ed_subjects g where g.id = v_group),
    v_code);
  perform lirc_private.notify_library_team(
    'path_finder_suggestion',
    'New book suggestion',
    format('%s suggested "%s" for %s.', v_name, v_book, v_label),
    '/path-finder?tab=suggestions');
  return jsonb_build_object('id', v_id, 'status', 'pending');
end $$;

revoke all on function public.lirc_path_finder_add_recommendation(text,bigint,text,bigint)
  from public, anon;
revoke all on function public.lirc_path_finder_suggest(text,bigint,text,bigint)
  from public, anon;
grant execute on function public.lirc_path_finder_add_recommendation(text,bigint,text,bigint)
  to authenticated;
grant execute on function public.lirc_path_finder_suggest(text,bigint,text,bigint)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Suggestion JSON: carry the Gen Ed group label when present
-- ---------------------------------------------------------------------------
create or replace function lirc_private.path_finder_suggestion_json(
  p_row public.subject_recommendations)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select lirc_private.path_finder_book_json(p_row.book_id)
    || jsonb_build_object(
      'id', p_row.id,
      'course_code', p_row.course_code,
      'gen_ed_subject_id', p_row.gen_ed_subject_id,
      'gen_ed_label', (
        select g.label from public.gen_ed_subjects g
        where g.id = p_row.gen_ed_subject_id),
      'course_title', coalesce(
        (select g.label from public.gen_ed_subjects g
         where g.id = p_row.gen_ed_subject_id),
        (select s.course_title from public.curriculum_subjects s
         where upper(btrim(s.course_code)) = p_row.course_code
         order by s.id limit 1)),
      'status', p_row.status,
      'source', p_row.source,
      'note', p_row.note,
      'created_at', p_row.created_at,
      'reviewed_at', p_row.reviewed_at,
      'review_note', p_row.review_note,
      'recommended_by_name', (
        select btrim(u.first_name || ' ' || u.surname) from public."usersData" u
        where u.id = p_row.recommended_by),
      'reviewed_by_name', (
        select btrim(u.first_name || ' ' || u.surname) from public."usersData" u
        where u.id = p_row.reviewed_by)
    );
$$;
revoke all on function lirc_private.path_finder_suggestion_json(public.subject_recommendations)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
