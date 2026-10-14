-- The template list is read one page at a time (it now sits side by side
-- with the queue in a fixed-height panel), so the page state keeps only the
-- counts.
begin;

create or replace function public.lirc_barcode_templates(
  p_limit integer default 6,
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
  if not lirc_private.is_admin() then
    raise exception 'Admin access required to read templates.' using errcode = '42501';
  end if;
  v_limit := least(greatest(coalesce(p_limit, 6), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into v_total from public.barcode_templates;

  select coalesce(jsonb_agg(
           lirc_private.barcode_template_json(x.id)
           order by x.created_at desc, x.id desc), '[]'::jsonb)
    into v_rows
  from (
    select t.id, t.created_at
    from public.barcode_templates t
    order by t.created_at desc, t.id desc
    limit v_limit offset v_offset
  ) x;

  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'has_next', (v_offset + v_limit) < v_total);
end $$;

-- The page state now carries only the counts; the queue and the template
-- list load their own pages.
create or replace function public.lirc_barcode_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  return jsonb_build_object('counts', lirc_private.barcode_counts());
end $$;

revoke all on function
  public.lirc_barcode_templates(integer, integer),
  public.lirc_barcode_state()
  from public, anon;
grant execute on function
  public.lirc_barcode_templates(integer, integer),
  public.lirc_barcode_state()
  to authenticated;

notify pgrst, 'reload schema';
commit;
