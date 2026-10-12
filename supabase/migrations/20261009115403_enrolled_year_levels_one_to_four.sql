-- Enrolled students use confirmed levels 1–4. Preserve legacy records for review.
-- No student status, stored level or attendance history is rewritten.
CREATE OR REPLACE FUNCTION public.lookup_attendance_card(p_library_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u public."usersData"%ROWTYPE; term public.semesters%ROWTYPE;
 enrollment public.student_enrollments%ROWTYPE; visit public.attendance%ROWTYPE; startyear integer; estimate integer;
BEGIN
 IF lirc_private.attendance_staff_id() IS NULL THEN RAISE EXCEPTION 'Staff access required.'; END IF;
 SELECT * INTO u FROM public."usersData" WHERE library_id=btrim(p_library_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Library card not found.'; END IF;
 SELECT * INTO term FROM public.semesters WHERE is_active;
 SELECT a.start_year INTO startyear FROM public.academic_years a WHERE a.id=term.academic_year_id;
 IF lower(btrim(u.role))='student' AND u.library_id ~ '^[0-9]{2}-' THEN
  estimate:=startyear-(2000+substring(u.library_id FROM 1 FOR 2)::integer)+1;
 END IF;
 IF lower(btrim(u.role))='student' THEN
  SELECT * INTO enrollment FROM public.student_enrollments WHERE user_profile_id=u.id AND academic_year_id=term.academic_year_id;
 END IF;
 SELECT * INTO visit FROM public.attendance WHERE user_profile_id=u.id AND time_out IS NULL;
 RETURN jsonb_build_object(
  'profile',jsonb_build_object('id',u.id,'library_id',u.library_id,'first_name',u.first_name,'surname',u.surname,
     'middle_initial',u.middle_initial,'suffix',u.suffix,'role',u.role),
  'active_semester',CASE WHEN term.id IS NULL THEN NULL ELSE to_jsonb(term) END,
  'estimated_year_level',case when estimate between 1 and 4 then estimate else null end,
  'enrollment',CASE WHEN enrollment.id IS NULL THEN NULL ELSE to_jsonb(enrollment) END,
  'open_visit',CASE WHEN visit.id IS NULL THEN NULL ELSE to_jsonb(visit) END);
END;
$function$

;
CREATE OR REPLACE FUNCTION lirc_private.guard_student_enrollment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE staff bigint; student_role text; admission integer; expected integer; startyear integer; card text;
BEGIN
 staff:=lirc_private.attendance_staff_id();
 IF staff IS NULL THEN RAISE EXCEPTION 'A signed-in admin or librarian must validate enrollment.'; END IF;
 -- Serialize with time-in for this student so status cannot change mid-validation.
 SELECT lower(btrim(role)),library_id INTO student_role,card
 FROM public."usersData" WHERE id=NEW.user_profile_id FOR UPDATE;
 IF student_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Enrollment records are for students only.'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.user_profile_id,NEW.academic_year_id,NEW.legacy_semester_id) IS DISTINCT FROM (OLD.user_profile_id,OLD.academic_year_id,OLD.legacy_semester_id) THEN
   RAISE EXCEPTION 'Enrollment student, academic year, and migration provenance cannot be changed.';
  END IF;
  NEW.created_at:=OLD.created_at;
 END IF;
 NEW.year_level_note:=nullif(btrim(NEW.year_level_note),'');
 NEW.validation_reference:=nullif(btrim(NEW.validation_reference),'');
 IF NEW.status='unverified' THEN
  NEW.validated_at:=NULL; NEW.validated_by:=NULL;
 ELSE
  IF NEW.validation_reference IS NULL THEN
   RAISE EXCEPTION 'Provide an enrollment validation source/reference.';
  END IF;
  NEW.validated_at:=now(); NEW.validated_by:=staff;
 END IF;
 SELECT a.start_year INTO startyear FROM public.academic_years a WHERE a.id=NEW.academic_year_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Academic year not found.'; END IF;
 IF TG_OP='INSERT' AND NEW.legacy_semester_id IS NOT NULL THEN
  RAISE EXCEPTION 'New annual enrollment records must not set legacy_semester_id.';
 END IF;
 IF card ~ '^[0-9]{2}-' THEN
  admission:=2000+substring(card FROM 1 FOR 2)::integer;
  expected:=startyear-admission+1;
 END IF;
 IF NEW.status='enrolled' AND (NEW.year_level IS NULL OR NEW.year_level NOT BETWEEN 1 AND 4) THEN
  RAISE EXCEPTION 'Enrolled students must have a confirmed year level from 1 to 4. Review the school record; do not infer withdrawal from the card.';
 END IF;
 IF NEW.status='enrolled' AND (NEW.year_level IS NULL OR
     ((expected IS NULL OR expected NOT BETWEEN 1 AND 4 OR NEW.year_level<>expected) AND NEW.year_level_note IS NULL)) THEN
  RAISE EXCEPTION 'Provide a verified year level and a reason when it differs from or cannot be estimated from the card.';
 END IF;
 NEW.updated_at:=now(); RETURN NEW;
END;
$function$

;
CREATE OR REPLACE FUNCTION lirc_private.guard_attendance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE staff bigint; visit_role text; term public.semesters%ROWTYPE; enrollment public.student_enrollments%ROWTYPE;
BEGIN
 staff:=lirc_private.attendance_staff_id();
 IF staff IS NULL THEN RAISE EXCEPTION 'Only a signed-in admin or librarian can record attendance.'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.time_out IS NOT NULL THEN RAISE EXCEPTION 'This visit is already checked out.'; END IF;
  IF NEW.time_out IS NULL THEN RAISE EXCEPTION 'A time-out is required.'; END IF;
  -- App updates may change only time_out. All history is immutable.
  IF (to_jsonb(NEW)-'time_out'-'checked_out_by') IS DISTINCT FROM (to_jsonb(OLD)-'time_out'-'checked_out_by') THEN
   RAISE EXCEPTION 'Existing attendance details cannot be changed.';
  END IF;
  NEW.time_out:=greatest(clock_timestamp(),OLD.time_in); NEW.checked_out_by:=staff;
  RETURN NEW;
 END IF;
 -- Lock profile to serialize time-in and enrollment edits.
 SELECT lower(btrim(role)) INTO visit_role FROM public."usersData" WHERE id=NEW.user_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Library user not found.'; END IF;
 SELECT * INTO term FROM public.semesters WHERE id=NEW.semester_id FOR SHARE;
 IF NOT FOUND OR NOT term.is_active THEN RAISE EXCEPTION 'New time-ins must use the active semester.'; END IF;
 IF (clock_timestamp() AT TIME ZONE 'Asia/Manila')::date NOT BETWEEN term.starts_on AND term.ends_on THEN
  RAISE EXCEPTION 'The active semester is outside its date range. Ask staff to configure the current semester.';
 END IF;
 NEW.purpose_of_visit:=btrim(NEW.purpose_of_visit);
 NEW.role_at_visit:=visit_role;
 NEW.student_enrollment_id:=NULL; NEW.year_level:=NULL; NEW.year_level_note:=NULL;
 IF visit_role='student' THEN
  SELECT * INTO enrollment FROM public.student_enrollments
   WHERE user_profile_id=NEW.user_profile_id AND academic_year_id=term.academic_year_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No enrollment validation for this academic year. Student is unverified.'; END IF;
  IF enrollment.status<>'enrolled' OR enrollment.validated_at IS NULL OR (enrollment.year_level IS NULL OR enrollment.year_level NOT BETWEEN 1 AND 4) THEN
   RAISE EXCEPTION 'Student is not validated as enrolled for this academic year (status: %).', enrollment.status;
  END IF;
  NEW.student_enrollment_id:=enrollment.id; NEW.year_level:=enrollment.year_level;
  NEW.year_level_note:=enrollment.year_level_note;
 END IF;
 NEW.time_in:=clock_timestamp(); NEW.created_at:=NEW.time_in;
 NEW.time_out:=NULL; NEW.checked_out_by:=NULL; NEW.recorded_by:=staff;
 RETURN NEW;
END;
$function$

;
CREATE OR REPLACE FUNCTION lirc_private.filtered_annual_enrollment(year_id bigint, f jsonb)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object('id',u.id,'profile',jsonb_build_object('id',u.id,'library_id',u.library_id,'first_name',u.first_name,'surname',u.surname,'middle_initial',u.middle_initial,'suffix',u.suffix,'role',u.role),
  'full_name',concat_ws(' ',u.first_name,u.middle_initial,u.surname,u.suffix),'library_id',u.library_id,
  'enrollment',case when e.id is null then null else to_jsonb(e) end,'status',coalesce(e.status,'unverified'),'year_level',e.year_level,
  'needs_review',coalesce((e.status='enrolled' and (e.year_level is null or e.year_level not between 1 and 4)),false),'estimated_level',estimate.level,'validated_at',e.validated_at,'created_at',e.created_at,'updated_at',e.updated_at,
  'validator',concat_ws(' ',validator.first_name,validator.surname),'department',u.department_label,'program',u.program_label,
  'auth_linked',u.user_id is not null)
 from lirc_private.profile_dimensions u cross join public.academic_years ay
 left join public.student_enrollments e on e.user_profile_id=u.id and e.academic_year_id=ay.id
 left join public."usersData" validator on validator.id=e.validated_by
 cross join lateral (select case when u.library_id ~ '^[0-9]{2}-' then ay.start_year-(2000+substring(u.library_id from 1 for 2)::int)+1 else null end raw) admission
 cross join lateral (select case when admission.raw between 1 and 4 then admission.raw else null end level) estimate
 where ay.id=year_id and lower(btrim(u.role))='student'
 and lirc_private.report_search(to_jsonb(u),f)
 and lirc_private.report_classification(u.classification_department,f->>'department')
 and lirc_private.report_classification(u.classification_program,f->>'program')
 and (coalesce(f->>'cohort','')='' or (u.library_id ~ '^[0-9]{2}-' and substring(u.library_id from 1 for 2)=f->>'cohort'))
 and (coalesce(f->>'status','')='' or coalesce(e.status,'unverified')=f->>'status')
 and (coalesce(f->>'year_level','')='' or (f->>'year_level'='none' and e.year_level is null) or e.year_level::text=f->>'year_level')
 and (coalesce(f->>'estimated_level','')='' or (f->>'estimated_level'='none' and estimate.level is null) or estimate.level::text=f->>'estimated_level')
 and (coalesce(f->>'conflict','')='' or (f->>'conflict'='unsupported' and estimate.level is null) or (f->>'conflict'='unverified' and e.year_level is null) or (f->>'conflict'='matches' and e.year_level=estimate.level) or (f->>'conflict'='differs' and e.year_level<>estimate.level))
 and (coalesce(f->>'validation_state','')='' or (f->>'validation_state'='missing' and e.id is null) or (f->>'validation_state'='unverified' and e.id is not null and e.validated_at is null) or (f->>'validation_state'='validated' and e.validated_at is not null and not coalesce((e.status='enrolled' and (e.year_level is null or e.year_level not between 1 and 4)),false)) or (f->>'validation_state'='needs_review' and (e.status='enrolled' and (e.year_level is null or e.year_level not between 1 and 4))))
 and (coalesce(f->>'auth','')='' or (f->>'auth'='yes' and u.user_id is not null) or (f->>'auth'='no' and u.user_id is null))
 and (coalesce(f->>'validator','')='' or e.validated_by::text=f->>'validator')
 and (nullif(f->>'validated_from','') is null or e.validated_at >= (f->>'validated_from')::timestamptz)
 and (nullif(f->>'validated_to','') is null or e.validated_at < (f->>'validated_to')::timestamptz)
 and (coalesce(f->>'reference','')='' or strpos(lower(e.validation_reference),lower(f->>'reference'))>0)
 and (coalesce(f->>'notes','')='' or strpos(lower(e.year_level_note),lower(f->>'notes'))>0);
$function$

;
CREATE OR REPLACE FUNCTION public.lirc_annual_enrollment_report(p_academic_year_id bigint, p_filters jsonb DEFAULT '{}'::jsonb, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   'summary',(select jsonb_build_object('total',count(*),'validated',count(*) filter(where r->>'validated_at' is not null and not (r->>'needs_review')::boolean),'unverified',count(*) filter(where r->>'status'='unverified'),'needs_review',count(*) filter(where (r->>'needs_review')::boolean)) from filtered),
   'has_next',(select count(*) from filtered)>$4+$3,'as_of',now())
 $query$,ordering,direction,direction) into result using p_academic_year_id,p_filters,p_page_size,(p_page::bigint-1)*p_page_size;
 return result;
end $function$

;
NOTIFY pgrst, 'reload schema';

