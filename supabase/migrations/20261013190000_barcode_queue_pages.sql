-- The waiting barcode queue is read one page at a time now (it can grow
-- long), so the page state no longer carries the whole list.
begin;

create or replace function public.lirc_barcode_queue(
  p_limit integer default 25,
  p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  v_limit := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into v_total
  from public.barcode_entries e
  where e.template_id is null;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id,
      'accession_number', x.accession_number,
      'added_at', x.added_at,
      'added_by', x.added_by) order by x.added_at desc, x.id desc), '[]'::jsonb)
    into v_rows
  from (
    select e.id, e.accession_number, e.added_at,
           concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix) as added_by
    from public.barcode_entries e
    join public."usersData" u on u.id = e.added_by
    where e.template_id is null
    order by e.added_at desc, e.id desc
    limit v_limit offset v_offset
  ) x;

  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'has_next', (v_offset + v_limit) < v_total);
end $$;

-- The page state keeps the counts and the template list only; the queue
-- list loads its own page.
create or replace function public.lirc_barcode_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_templates jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
           lirc_private.barcode_template_json(y.id)
           order by y.created_at desc, y.id desc), '[]'::jsonb)
    into v_templates
  from (
    select t.id, t.created_at
    from public.barcode_templates t
    order by t.created_at desc, t.id desc
    limit 50
  ) y;
  return jsonb_build_object(
    'counts', lirc_private.barcode_counts(),
    'templates', case when lirc_private.is_admin() then v_templates else '[]'::jsonb end);
end $$;

revoke all on function
  public.lirc_barcode_queue(integer, integer),
  public.lirc_barcode_state()
  from public, anon;
grant execute on function
  public.lirc_barcode_queue(integer, integer),
  public.lirc_barcode_state()
  to authenticated;

notify pgrst, 'reload schema';
commit;
