-- Barcode printing: staff and librarians add accession numbers to a queue;
-- the admin turns everything queued into a printable Excel template and
-- downloads it from a list. Numbers are flagged once they are templated.
--
-- Rules:
--   * Adding/removing queue numbers: staff, librarian or admin.
--   * Creating a template and reading its numbers: admin only.
--   * One number can only ever be added once (case-insensitive): it is either
--     in the queue or already inside a template. Old templates can be
--     downloaded again when a label needs a reprint.
begin;

create table if not exists public.barcode_templates (
  id bigint generated always as identity primary key,
  name text not null,
  item_count integer not null default 0,
  created_by bigint not null references public."usersData"(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint barcode_templates_name_check check (char_length(btrim(name)) between 1 and 200)
);

create table if not exists public.barcode_entries (
  id bigint generated always as identity primary key,
  accession_number text not null,
  template_id bigint references public.barcode_templates(id) on delete restrict,
  added_by bigint not null references public."usersData"(id) on delete restrict,
  added_at timestamptz not null default now(),
  templated_at timestamptz,
  constraint barcode_entries_number_check check (char_length(btrim(accession_number)) between 1 and 120)
);
create unique index if not exists barcode_entries_number_once
  on public.barcode_entries (lower(accession_number));
create index if not exists barcode_entries_queue_idx
  on public.barcode_entries (template_id, added_at desc, id desc);
create index if not exists barcode_entries_template_idx
  on public.barcode_entries (template_id, added_at, id);

alter table public.barcode_templates enable row level security;
alter table public.barcode_entries enable row level security;
revoke all privileges on table public.barcode_templates, public.barcode_entries
  from public, anon, authenticated;
grant all privileges on table public.barcode_templates, public.barcode_entries
  to service_role;
-- No client policies: only the RPCs below read or write these tables.

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function lirc_private.barcode_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'queued', (select count(*) from public.barcode_entries e where e.template_id is null),
    'done', (select count(*) from public.barcode_entries e where e.template_id is not null),
    'templates', (select count(*) from public.barcode_templates t));
$$;
revoke all on function lirc_private.barcode_counts() from public, anon, authenticated;

create or replace function lirc_private.barcode_template_json(p_template_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'item_count', t.item_count,
    'created_at', t.created_at,
    'created_by', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix))
  from public.barcode_templates t
  join public."usersData" u on u.id = t.created_by
  where t.id = p_template_id;
$$;
revoke all on function lirc_private.barcode_template_json(bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: everything the page shows (counts, queue, templates)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_barcode_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_queue jsonb;
  v_templates jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id,
      'accession_number', x.accession_number,
      'added_at', x.added_at,
      'added_by', x.added_by) order by x.added_at desc, x.id desc), '[]'::jsonb)
    into v_queue
  from (
    select e.id, e.accession_number, e.added_at,
           concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix) as added_by
    from public.barcode_entries e
    join public."usersData" u on u.id = e.added_by
    where e.template_id is null
    order by e.added_at desc, e.id desc
    limit 200
  ) x;
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
    'queue', v_queue,
    'templates', case when lirc_private.is_admin() then v_templates else '[]'::jsonb end);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: add numbers to the queue (blanks are ignored, duplicates are skipped)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_barcode_add(p_numbers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_number text;
  v_key text;
  v_reason text;
  v_added int := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_seen text[] := '{}';
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if p_numbers is null or jsonb_typeof(p_numbers) <> 'array'
     or jsonb_array_length(p_numbers) = 0 then
    raise exception 'Add at least one accession number.';
  end if;
  if jsonb_array_length(p_numbers) > 200 then
    raise exception 'At most 200 numbers can be added at once.';
  end if;

  for v_number in select btrim(value) from jsonb_array_elements_text(p_numbers) loop
    if v_number = '' then
      continue;
    end if;
    if char_length(v_number) > 120 then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'accession_number', left(v_number, 40),
        'reason', 'Longer than 120 characters'));
      continue;
    end if;
    v_key := lower(v_number);
    if v_key = any (v_seen) then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'accession_number', v_number,
        'reason', 'Repeated in the list'));
      continue;
    end if;
    v_seen := v_seen || v_key;

    select case when e.template_id is null
                then 'Already in the queue'
                else 'Already in a template' end
      into v_reason
    from public.barcode_entries e
    where lower(e.accession_number) = v_key
    limit 1;
    if v_reason is not null then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'accession_number', v_number,
        'reason', v_reason));
      continue;
    end if;

    begin
      insert into public.barcode_entries (accession_number, added_by)
      values (v_number, v_operator);
    exception when unique_violation then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'accession_number', v_number,
        'reason', 'Already in the queue'));
      continue;
    end;
    v_added := v_added + 1;
  end loop;

  return jsonb_build_object(
    'added', v_added,
    'skipped', v_skipped,
    'counts', lirc_private.barcode_counts());
end $$;

-- ---------------------------------------------------------------------------
-- RPC: remove one number from the queue (only before it is templated)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_barcode_remove(p_entry_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_template bigint;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  select e.template_id into v_template
  from public.barcode_entries e
  where e.id = p_entry_id;
  if not found then
    raise exception 'Number not found.';
  end if;
  if v_template is not null then
    raise exception 'This number is already in a template and cannot be removed.';
  end if;
  delete from public.barcode_entries where id = p_entry_id;
  return jsonb_build_object(
    'removed', true,
    'counts', lirc_private.barcode_counts());
end $$;

-- ---------------------------------------------------------------------------
-- RPC: create a template from everything queued (admin only)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_barcode_create_template(p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_name text;
  v_template_id bigint;
  v_count int := 0;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if not lirc_private.is_admin() then
    raise exception 'Admin access required to create templates.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.barcode_entries e where e.template_id is null) then
    raise exception 'There are no new numbers in the queue.';
  end if;
  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then
    v_name := 'Barcodes - '
      || to_char(now() at time zone 'Asia/Manila', 'Mon DD, YYYY FMHH12:MI AM');
  end if;
  if char_length(v_name) > 200 then
    raise exception 'Template name must be 200 characters or fewer.';
  end if;

  insert into public.barcode_templates (name, created_by)
  values (v_name, v_operator)
  returning id into v_template_id;

  update public.barcode_entries
     set template_id = v_template_id, templated_at = now()
   where template_id is null;
  get diagnostics v_count = row_count;

  update public.barcode_templates
     set item_count = v_count
   where id = v_template_id;

  return jsonb_build_object(
    'template', lirc_private.barcode_template_json(v_template_id),
    'counts', lirc_private.barcode_counts());
end $$;

-- ---------------------------------------------------------------------------
-- RPC: the numbers inside one template (admin only, used for the download)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_barcode_template_entries(p_template_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_numbers jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if not lirc_private.is_admin() then
    raise exception 'Admin access required to download templates.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.barcode_templates t where t.id = p_template_id) then
    raise exception 'Template not found.';
  end if;
  select coalesce(jsonb_agg(e.accession_number order by e.added_at, e.id), '[]'::jsonb)
    into v_numbers
  from public.barcode_entries e
  where e.template_id = p_template_id;
  return jsonb_build_object(
    'template', lirc_private.barcode_template_json(p_template_id),
    'numbers', v_numbers);
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function
  public.lirc_barcode_state(),
  public.lirc_barcode_add(jsonb),
  public.lirc_barcode_remove(bigint),
  public.lirc_barcode_create_template(text),
  public.lirc_barcode_template_entries(bigint)
  from public, anon;
grant execute on function
  public.lirc_barcode_state(),
  public.lirc_barcode_add(jsonb),
  public.lirc_barcode_remove(bigint),
  public.lirc_barcode_create_template(text),
  public.lirc_barcode_template_entries(bigint)
  to authenticated;

notify pgrst, 'reload schema';
commit;
