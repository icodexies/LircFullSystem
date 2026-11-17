-- Restore the borrower summary to the statistics overview. The security
-- hardening migration recreated the function without this block, so the
-- Statistics borrower card showed 0 while the detail RPC still had records.
begin;

do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lirc_statistics_overview'
    and p.pronargs = 1;
  if v_def is null then
    raise exception 'lirc_statistics_overview was not found.';
  end if;

  if position($q$'borrowers', jsonb_build_object$q$ in v_def) > 0 then
    raise notice 'overview already carries the borrowers summary.';
    return;
  end if;

  v_new := replace(v_def,
    $p$'members', jsonb_build_object($p$,
    $r$'borrowers', jsonb_build_object(
      'borrowers', (
        select count(distinct l.user_profile_id)
        from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end),
      'loans', (
        select count(*)
        from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end),
      'avg_loans', (
        select round(count(*)::numeric
                     / greatest(count(distinct l.user_profile_id), 1), 1)
        from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end),
      'repeat', (
        select count(*) from (
          select l.user_profile_id
          from public.book_loans l
          where v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end
          group by l.user_profile_id
          having count(*) > 1) x),
      'first_time', (
        select count(*) from (
          select l.user_profile_id
          from public.book_loans l
          where v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end
          group by l.user_profile_id) b
        where not exists (
          select 1 from public.book_loans before
          where before.user_profile_id = b.user_profile_id
            and before.borrowed_at < v_start)),
      'with_overdue', (
        select count(distinct l.user_profile_id)
        from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is null and l.due_at < now())),
    'members', jsonb_build_object($r$);

  if position($q$'borrowers', jsonb_build_object$q$ in v_new) = 0 then
    raise exception 'members pattern not found in lirc_statistics_overview.';
  end if;
  execute v_new;
end $$;

notify pgrst, 'reload schema';
commit;
