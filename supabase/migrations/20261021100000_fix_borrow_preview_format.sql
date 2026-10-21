-- Fix: the borrow window failed for students whose current-year enrollment
-- exists but is not valid (pending, not yet validated, or missing a year
-- level). lirc_borrow_preview built the reason with
--   format('Student is not validated as enrolled (status: %).', e.status)
-- where the literal "%" before ")" was read as a type specifier — PostgreSQL
-- raised 'unrecognized format() type specifier ")"', so the preview (and
-- therefore the borrow flow) stopped with a database error instead of showing
-- the validation warning. The status uses %s now.
--
-- Everything else is identical to the version in 20261020110000.

create or replace function public.lirc_borrow_preview(p_library_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_card text;
  u public."usersData"%ROWTYPE;
  v_active_year_id bigint;
  v_year_starts date;
  v_year_ends date;
  e public.student_enrollments%ROWTYPE;
  v_active int;
  v_overdue int;
  v_overdue_text text;
  v_required boolean := false;
  v_ok boolean := true;
  v_reason text := '';
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  v_card := btrim(p_library_id);
  if v_card ~ '^\*.*\*$' and length(v_card) > 2 then
    v_card := substr(v_card, 2, length(v_card) - 2);
  end if;
  if v_card = '' or length(v_card) > 120 then
    raise exception 'Enter a valid library card.';
  end if;

  select * into u from public."usersData" where library_id = v_card;
  if not found then raise exception 'Library card not found.'; end if;

  select ay.id, ay.starts_on, ay.ends_on
    into v_active_year_id, v_year_starts, v_year_ends
  from public.semesters s
  join public.academic_years ay on ay.id = s.academic_year_id
  where s.is_active
  limit 1;

  if lower(btrim(u.role::text)) = 'student' and v_active_year_id is not null then
    v_required := true;
    select * into e from public.student_enrollments
    where user_profile_id = u.id and academic_year_id = v_active_year_id;
    if not found then
      v_ok := false;
      v_reason := 'Student has no annual validation for the current school year.';
    elsif e.status <> 'enrolled' or e.validated_at is null
          or e.year_level is null or e.year_level not between 1 and 4 then
      v_ok := false;
      v_reason := format('Student is not validated as enrolled (status: %s).', e.status);
    end if;
  end if;

  select count(*) filter (where l.returned_at is null),
         count(*) filter (where l.returned_at is null and l.due_at < now())
    into v_active, v_overdue
  from public.book_loans l
  where l.user_profile_id = u.id;

  select string_agg(x.item, ', ') into v_overdue_text
  from (
    select b.book_name
             || ' (due '
             || to_char(l.due_at at time zone 'Asia/Manila', 'Mon DD')
             || ')' as item
    from public.book_loans l
    join public.book_accession_numbers a on a.id = l.accession_id
    join public.books b on b.id = a.book_id
    where l.user_profile_id = u.id
      and l.returned_at is null
      and l.due_at < now()
    order by l.due_at
    limit 3
  ) x;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', u.id,
      'full_name', lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix),
      'library_id', u.library_id,
      'role', u.role),
    'student_check', jsonb_build_object(
      'required', v_required,
      'ok', v_ok,
      'reason', v_reason,
      'year_starts', v_year_starts,
      'year_ends', v_year_ends),
    'active_loans', coalesce(v_active, 0),
    'overdue_loans', coalesce(v_overdue, 0),
    'overdue_text', coalesce(v_overdue_text, ''));
end $$;

revoke all on function public.lirc_borrow_preview(text) from public, anon;
grant execute on function public.lirc_borrow_preview(text) to authenticated;

-- Self-check: a student with an invalid current-year enrollment must return a
-- warning reason instead of raising. Run manually after applying:
--   select public.lirc_borrow_preview('22-7387');
