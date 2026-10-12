-- Additional reporting RPCs for the POST-MIGRATION annual schema.
-- Run only after the supplied annual migration. Does not seed/reset data.
begin;
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='student_enrollments' and column_name='academic_year_id') then
  raise exception 'Apply the supplied annual validation migration first; do not rerun the base schema.';
 end if;
end $$;
-- The older OPAC restrictive profile policy otherwise AND-blocks staff reads.
drop policy if exists "LIRC own profile boundary" on public."usersData";
create policy "LIRC own profile boundary" on public."usersData" as restrictive for select to authenticated
 using(user_id=(select auth.uid()) or (select lirc_private.attendance_staff_id()) is not null);
-- Existing attendance_staff_profile_read remains the staff-only permissive rule.

-- Discover actual profile classification FK names once, at migration time.
-- This avoids guessing department/program/position table names in the browser.
do $$
declare kind text; fk record; label_column text; joins text:=''; fields text:='u.*';
begin
 foreach kind in array array['department','program','position'] loop
  select a.attname, c.confrelid, k.attname as key_column, n.nspname, t.relname into fk
   from pg_catalog.pg_constraint c join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
   join pg_catalog.pg_attribute k on k.attrelid=c.confrelid and k.attnum=c.confkey[1]
   join pg_catalog.pg_class t on t.oid=c.confrelid join pg_catalog.pg_namespace n on n.oid=t.relnamespace
   where c.contype='f' and c.conrelid='public."usersData"'::regclass and array_length(c.conkey,1)=1
     and (a.attname like '%'||kind||'%' or t.relname like '%'||kind||'%') order by a.attname limit 1;
  if found then
   select attname into label_column from pg_catalog.pg_attribute where attrelid=fk.confrelid and attnum>0 and not attisdropped
    and attname in ('name',kind||'_name','title','code') order by case attname when 'name' then 0 when kind||'_name' then 1 when 'title' then 2 else 3 end limit 1;
   if label_column is null then raise exception 'No name/title/code label column in classification table %.%. Configure this migration for the actual lookup label.',fk.nspname,fk.relname; end if;
   joins:=joins||format(' left join %I.%I %I on %I.%I=u.%I',fk.nspname,fk.relname,'dim_'||kind,'dim_'||kind,fk.key_column,fk.attname);
   fields:=fields||format(',u.%I::text as %I,%I.%I::text as %I',fk.attname,'classification_'||kind,'dim_'||kind,label_column,kind||'_label');
  else
   fields:=fields||format(',null::text as %I,null::text as %I','classification_'||kind,kind||'_label');
   raise notice 'No % classification foreign key found on usersData; classification is shown as unassigned.',kind;
  end if;
 end loop;
 execute 'create or replace view lirc_private.profile_dimensions as select '||fields||' from public."usersData" u'||joins;
end $$;
revoke all on lirc_private.profile_dimensions from public,anon,authenticated;
create or replace function lirc_private.report_search(p jsonb,f jsonb)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(nullif(btrim(f->>'search'),''),'')='' or strpos(lower(case coalesce(f->>'search_by','full_name')
  when 'library_id' then p->>'library_id' when 'first_name' then p->>'first_name' when 'surname' then p->>'surname'
  when 'middle_initial' then p->>'middle_initial' when 'suffix' then p->>'suffix' else concat_ws(' ',p->>'first_name',p->>'middle_initial',p->>'surname',p->>'suffix') end),lower(left(btrim(f->>'search'),120)))>0;
$$;
create or replace function lirc_private.report_classification(value text, requested text)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(requested,'')='' or (requested='unassigned' and value is null) or value=requested;
$$;
create or replace function public.lirc_attendance_options()
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if lirc_private.attendance_staff_id() is null then raise exception 'Staff access required.' using errcode='42501'; end if;
 select jsonb_build_object(
  'department',coalesce((select jsonb_agg(x order by x->>'name') from (select distinct jsonb_build_object('id',classification_department,'name',department_label) x from lirc_private.profile_dimensions where classification_department is not null) q),'[]'::jsonb),
  'program',coalesce((select jsonb_agg(x order by x->>'name') from (select distinct jsonb_build_object('id',classification_program,'name',program_label) x from lirc_private.profile_dimensions where classification_program is not null) q),'[]'::jsonb),
  'position',coalesce((select jsonb_agg(x order by x->>'name') from (select distinct jsonb_build_object('id',classification_position,'name',position_label) x from lirc_private.profile_dimensions where classification_position is not null) q),'[]'::jsonb),
  'staff',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',concat_ws(' ',first_name,surname)) order by surname,id) from public."usersData" where lower(btrim(role)) in ('admin','librarian')),'[]'::jsonb)) into result;
 return result;
end $$;

create or replace function lirc_private.filtered_attendance(period_id bigint,f jsonb,across_periods boolean)
returns setof jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',a.id,'user_profile_id',a.user_profile_id,'semester_id',a.semester_id,
  'full_name',concat_ws(' ',u.first_name,u.middle_initial,u.surname,u.suffix),'library_id',u.library_id,
  'role',a.role_at_visit,'year_level',a.year_level,'year_level_note',a.year_level_note,'purpose',a.purpose_of_visit,
  'time_in',a.time_in,'time_out',a.time_out,'created_at',a.created_at,
  'duration',case when a.time_out is null then null else extract(epoch from a.time_out-a.time_in)/60 end,
  'department',u.department_label,'program',u.program_label,'position',u.position_label,
  'recorded_by',concat_ws(' ',rec.first_name,rec.surname),'checked_out_by',concat_ws(' ',out_staff.first_name,out_staff.surname),
  'semester',ay.name||' · '||s.name,'current_enrollment_status',case when a.role_at_visit='student' then coalesce(e.status,'unverified') else 'Not applicable' end)
 from public.attendance a join lirc_private.profile_dimensions u on u.id=a.user_profile_id
 join public.semesters s on s.id=a.semester_id join public.academic_years ay on ay.id=s.academic_year_id
 left join public.student_enrollments e on e.id=a.student_enrollment_id and e.academic_year_id=s.academic_year_id
 left join public."usersData" rec on rec.id=a.recorded_by left join public."usersData" out_staff on out_staff.id=a.checked_out_by
 where (case when across_periods then a.time_out is null else a.semester_id=period_id end)
 and lirc_private.report_search(to_jsonb(u),f)
 and (coalesce(f->>'role','')='' or a.role_at_visit=f->>'role')
 and (coalesce(f->>'status','')='' or (f->>'status'='open' and a.time_out is null) or (f->>'status'='completed' and a.time_out is not null))
 and (coalesce(f->>'year_level','')='' or (f->>'year_level'='na' and a.year_level is null) or a.year_level::text=f->>'year_level')
 and lirc_private.report_classification(u.classification_department,f->>'department')
 and lirc_private.report_classification(u.classification_program,f->>'program')
 and lirc_private.report_classification(u.classification_position,f->>'position')
 and (coalesce(f->>'purpose','')='' or a.purpose_of_visit=f->>'purpose' or (f->>'purpose'='Other' and a.purpose_of_visit not in ('Reading','Studying','Research','Borrowing/Returning','Computer Use')))
 and (coalesce(f->>'purpose_text','')='' or strpos(lower(a.purpose_of_visit),lower(f->>'purpose_text'))>0)
 and (nullif(f->>'arrival_from','') is null or a.time_in >= (f->>'arrival_from')::timestamptz) and (nullif(f->>'arrival_to','') is null or a.time_in < (f->>'arrival_to')::timestamptz)
 and (nullif(f->>'departure_from','') is null or a.time_out >= (f->>'departure_from')::timestamptz) and (nullif(f->>'departure_to','') is null or a.time_out < (f->>'departure_to')::timestamptz)
 and (nullif(f->>'time_start','') is null or (a.time_in at time zone 'Asia/Manila')::time >= (f->>'time_start')::time)
 and (nullif(f->>'time_end','') is null or (a.time_in at time zone 'Asia/Manila')::time <= (f->>'time_end')::time)
 and (nullif(f->>'duration_min','') is null or (a.time_out is not null and extract(epoch from a.time_out-a.time_in)/60 >= (f->>'duration_min')::numeric))
 and (nullif(f->>'duration_max','') is null or (a.time_out is not null and extract(epoch from a.time_out-a.time_in)/60 <= (f->>'duration_max')::numeric))
 and (nullif(f->>'elapsed_min','') is null or (a.time_out is null and extract(epoch from now()-a.time_in)/60 >= (f->>'elapsed_min')::numeric))
 and (nullif(f->>'elapsed_max','') is null or (a.time_out is null and extract(epoch from now()-a.time_in)/60 <= (f->>'elapsed_max')::numeric))
 and (coalesce(f->>'recorded_by','')='' or a.recorded_by::text=f->>'recorded_by')
 and (coalesce(f->>'checked_out_by','')='' or (f->>'checked_out_by'='none' and a.checked_out_by is null) or a.checked_out_by::text=f->>'checked_out_by')
 and (coalesce(f->>'enrollment_status','')='' or (f->>'enrollment_status'='na' and a.role_at_visit<>'student') or (a.role_at_visit='student' and coalesce(e.status,'unverified')=f->>'enrollment_status'))
 and (coalesce(f->>'note','')='' or (f->>'note'='yes' and nullif(a.year_level_note,'') is not null) or (f->>'note'='no' and nullif(a.year_level_note,'') is null));
$$;

create or replace function lirc_private.filtered_annual_enrollment(year_id bigint,f jsonb)
returns setof jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',u.id,'profile',jsonb_build_object('id',u.id,'library_id',u.library_id,'first_name',u.first_name,'surname',u.surname,'middle_initial',u.middle_initial,'suffix',u.suffix,'role',u.role),
  'full_name',concat_ws(' ',u.first_name,u.middle_initial,u.surname,u.suffix),'library_id',u.library_id,
  'enrollment',case when e.id is null then null else to_jsonb(e) end,'status',coalesce(e.status,'unverified'),'year_level',e.year_level,
  'estimated_level',estimate.level,'validated_at',e.validated_at,'created_at',e.created_at,'updated_at',e.updated_at,
  'validator',concat_ws(' ',validator.first_name,validator.surname),'department',u.department_label,'program',u.program_label,
  'auth_linked',u.user_id is not null)
 from lirc_private.profile_dimensions u cross join public.academic_years ay
 left join public.student_enrollments e on e.user_profile_id=u.id and e.academic_year_id=ay.id
 left join public."usersData" validator on validator.id=e.validated_by
 cross join lateral (select case when u.library_id ~ '^[0-9]{2}-' then ay.start_year-(2000+substring(u.library_id from 1 for 2)::int)+1 else null end raw) admission
 cross join lateral (select case when admission.raw between 1 and 10 then admission.raw else null end level) estimate
 where ay.id=year_id and lower(btrim(u.role))='student'
 and lirc_private.report_search(to_jsonb(u),f)
 and lirc_private.report_classification(u.classification_department,f->>'department')
 and lirc_private.report_classification(u.classification_program,f->>'program')
 and (coalesce(f->>'cohort','')='' or (u.library_id ~ '^[0-9]{2}-' and substring(u.library_id from 1 for 2)=f->>'cohort'))
 and (coalesce(f->>'status','')='' or coalesce(e.status,'unverified')=f->>'status')
 and (coalesce(f->>'year_level','')='' or (f->>'year_level'='none' and e.year_level is null) or e.year_level::text=f->>'year_level')
 and (coalesce(f->>'estimated_level','')='' or (f->>'estimated_level'='none' and estimate.level is null) or estimate.level::text=f->>'estimated_level')
 and (coalesce(f->>'conflict','')='' or (f->>'conflict'='unsupported' and estimate.level is null) or (f->>'conflict'='unverified' and e.year_level is null) or (f->>'conflict'='matches' and e.year_level=estimate.level) or (f->>'conflict'='differs' and e.year_level<>estimate.level))
 and (coalesce(f->>'validation_state','')='' or (f->>'validation_state'='missing' and e.id is null) or (f->>'validation_state'='unverified' and e.id is not null and e.validated_at is null) or (f->>'validation_state'='validated' and e.validated_at is not null))
 and (coalesce(f->>'auth','')='' or (f->>'auth'='yes' and u.user_id is not null) or (f->>'auth'='no' and u.user_id is null))
 and (coalesce(f->>'validator','')='' or e.validated_by::text=f->>'validator')
 and (nullif(f->>'validated_from','') is null or e.validated_at >= (f->>'validated_from')::timestamptz)
 and (nullif(f->>'validated_to','') is null or e.validated_at < (f->>'validated_to')::timestamptz)
 and (coalesce(f->>'reference','')='' or strpos(lower(e.validation_reference),lower(f->>'reference'))>0)
 and (coalesce(f->>'notes','')='' or strpos(lower(e.year_level_note),lower(f->>'notes'))>0);
$$;

create or replace function public.lirc_attendance_report(p_semester_id bigint,p_filters jsonb default '{}'::jsonb,p_page integer default 1,p_page_size integer default 20,p_open_across_semesters boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; ordering text; direction text;
begin
 if lirc_private.attendance_staff_id() is null then raise exception 'Staff access required.' using errcode='42501'; end if;
 if p_semester_id is null or not exists(select 1 from public.semesters where id=p_semester_id) then raise exception 'A valid selected period is required.'; end if;
 if p_page<1 or p_page>1000000 or p_page_size<1 or p_page_size>100 then raise exception 'Invalid report page.'; end if;
 if jsonb_typeof(p_filters)<>'object' then raise exception 'Invalid filters.'; end if;
 if coalesce(p_filters->>'search_by','full_name') not in ('full_name','library_id','first_name','surname','middle_initial','suffix') then raise exception 'Invalid search field.'; end if;
 ordering:=case coalesce(p_filters->>'sort','arrival') when 'arrival' then '(r->>''time_in'')::timestamptz' when 'departure' then '(r->>''time_out'')::timestamptz' when 'created' then '(r->>''created_at'')::timestamptz' when 'name' then 'r->>''full_name''' when 'card' then 'r->>''library_id''' when 'year_level' then '(r->>''year_level'')::int' when 'duration' then '(r->>''duration'')::numeric' else null end;
 if ordering is null then raise exception 'Invalid sort.'; end if;
 direction:=case coalesce(p_filters->>'direction','desc') when 'asc' then 'asc' when 'desc' then 'desc' else null end;
 if direction is null then raise exception 'Invalid sort direction.'; end if;
 execute format($query$
  with filtered as materialized (select r from lirc_private.filtered_attendance($1,$2,$5) r),
  page as (select r from filtered order by %s %s nulls last,(r->>'id')::bigint %s limit $3 offset $4)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(r) from page),'[]'::jsonb),
   'summary',(select jsonb_build_object('total',count(*),'unique_visitors',count(distinct r->>'user_profile_id'),'inside',count(*) filter(where r->>'time_out' is null),'average_duration',avg((r->>'duration')::numeric)) from filtered),
   'has_next',(select count(*) from filtered)>$4+$3,'as_of',now())
 $query$,ordering,direction,direction) into result using p_semester_id,p_filters,p_page_size,(p_page::bigint-1)*p_page_size,p_open_across_semesters;
 return result;
end $$;

create or replace function public.lirc_annual_enrollment_report(p_academic_year_id bigint,p_filters jsonb default '{}'::jsonb,p_page integer default 1,p_page_size integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; ordering text; direction text;
begin
 if lirc_private.attendance_staff_id() is null then raise exception 'Staff access required.' using errcode='42501'; end if;
 if p_academic_year_id is null or not exists(select 1 from public.academic_years where id=p_academic_year_id) then raise exception 'A valid selected period is required.'; end if;
 if p_page<1 or p_page>1000000 or p_page_size<1 or p_page_size>100 then raise exception 'Invalid report page.'; end if;
 if jsonb_typeof(p_filters)<>'object' then raise exception 'Invalid filters.'; end if;
 if coalesce(p_filters->>'search_by','full_name') not in ('full_name','library_id','first_name','surname','middle_initial','suffix') then raise exception 'Invalid search field.'; end if;
 ordering:=case coalesce(p_filters->>'sort','name') when 'name' then 'r->>''full_name''' when 'card' then 'r->>''library_id''' when 'year_level' then '(r->>''year_level'')::int' when 'status' then 'r->>''status''' when 'validated' then '(r->>''validated_at'')::timestamptz' when 'created' then '(r->>''created_at'')::timestamptz' when 'updated' then '(r->>''updated_at'')::timestamptz' else null end;
 if ordering is null then raise exception 'Invalid sort.'; end if;
 direction:=case coalesce(p_filters->>'direction','asc') when 'asc' then 'asc' when 'desc' then 'desc' else null end;
 if direction is null then raise exception 'Invalid sort direction.'; end if;
 execute format($query$
  with filtered as materialized (select r from lirc_private.filtered_annual_enrollment($1,$2) r),
  page as (select r from filtered order by %s %s nulls last,(r->>'id')::bigint %s limit $3 offset $4)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(r) from page),'[]'::jsonb),
   'summary',(select jsonb_build_object('total',count(*),'validated',count(*) filter(where r->>'validated_at' is not null),'unverified',count(*) filter(where r->>'status'='unverified')) from filtered),
   'has_next',(select count(*) from filtered)>$4+$3,'as_of',now())
 $query$,ordering,direction,direction) into result using p_academic_year_id,p_filters,p_page_size,(p_page::bigint-1)*p_page_size;
 return result;
end $$;

revoke all on function lirc_private.report_search(jsonb,jsonb),lirc_private.report_classification(text,text),lirc_private.filtered_attendance(bigint,jsonb,boolean),lirc_private.filtered_annual_enrollment(bigint,jsonb) from public,anon,authenticated;
revoke all on function public.lirc_attendance_report(bigint,jsonb,integer,integer,boolean),public.lirc_annual_enrollment_report(bigint,jsonb,integer,integer),public.lirc_attendance_options() from public,anon;
grant execute on function public.lirc_attendance_report(bigint,jsonb,integer,integer,boolean),public.lirc_annual_enrollment_report(bigint,jsonb,integer,integer),public.lirc_attendance_options() to authenticated;
create index if not exists lirc_attendance_departure_idx on public.attendance(semester_id,time_out,id) where time_out is not null;
create index if not exists lirc_attendance_role_idx on public.attendance(semester_id,role_at_visit,year_level);
create index if not exists lirc_profile_student_idx on public."usersData"(role,surname,id);
notify pgrst,'reload schema';
commit;
