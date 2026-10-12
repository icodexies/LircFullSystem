-- Run ONCE as postgres AFTER the already-applied lirc_attendance_semesters.sql.
-- Converts student validation to ONE record per ACADEMIC YEAR.
-- Attendance retains semester_id and all existing visit snapshots/timestamps.
-- No profiles, attendance rows, or enrollment rows are deleted.
-- Multiple old semester validations for one student/year require manual review:
-- migration stops and rolls back rather than choosing a status/year silently.
BEGIN;
LOCK TABLE public.student_enrollments,public.attendance,public.semesters IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND table_name='student_enrollments' AND column_name='academic_year_id') THEN
  RAISE EXCEPTION 'academic_year_id already exists. This migration is for the original semester-based schema and must run once only.';
 END IF;
END $$;
ALTER TABLE public.student_enrollments DISABLE TRIGGER guard_student_enrollment;
ALTER TABLE public.student_enrollments ADD COLUMN academic_year_id bigint REFERENCES public.academic_years(id) ON DELETE RESTRICT;
UPDATE public.student_enrollments e SET academic_year_id=s.academic_year_id FROM public.semesters s WHERE s.id=e.semester_id;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.student_enrollments GROUP BY user_profile_id,academic_year_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Multiple semester enrollment rows exist for the same student/academic year. Review/merge these explicitly before migrating. Nothing was changed.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.attendance a JOIN public.student_enrollments e ON e.id=a.student_enrollment_id
   JOIN public.semesters s ON s.id=a.semester_id WHERE e.user_profile_id<>a.user_profile_id OR e.academic_year_id<>s.academic_year_id) THEN
  RAISE EXCEPTION 'Existing attendance/enrollment links are inconsistent. Nothing was changed.';
 END IF;
END $$;
-- Remove only old composite attendance->enrollment FK(s), retaining other FKs.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.attendance'::regclass
  AND confrelid='public.student_enrollments'::regclass AND contype='f' LOOP
  EXECUTE format('ALTER TABLE public.attendance DROP CONSTRAINT %I',c.conname);
 END LOOP;
 -- Remove the old unique enrollment keys involving semester_id.
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.student_enrollments'::regclass
  AND contype='u' AND (SELECT attnum FROM pg_attribute WHERE attrelid='public.student_enrollments'::regclass AND attname='semester_id')=ANY(conkey) LOOP
  EXECUTE format('ALTER TABLE public.student_enrollments DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
DROP INDEX IF EXISTS public.student_enrollments_semester_status_idx;
-- Preserve original period provenance for any rows that existed before migration.
ALTER TABLE public.student_enrollments RENAME COLUMN semester_id TO legacy_semester_id;
ALTER TABLE public.student_enrollments ALTER COLUMN legacy_semester_id DROP NOT NULL;
ALTER TABLE public.student_enrollments ALTER COLUMN academic_year_id SET NOT NULL;
ALTER TABLE public.student_enrollments ADD CONSTRAINT student_enrollments_student_year_key UNIQUE(user_profile_id,academic_year_id);
ALTER TABLE public.student_enrollments ADD CONSTRAINT student_enrollments_id_student_key UNIQUE(id,user_profile_id);
ALTER TABLE public.attendance ADD CONSTRAINT attendance_annual_enrollment_fk
 FOREIGN KEY(student_enrollment_id,user_profile_id) REFERENCES public.student_enrollments(id,user_profile_id) ON DELETE RESTRICT;
CREATE INDEX student_enrollments_year_status_idx ON public.student_enrollments(academic_year_id,status);
REVOKE INSERT(legacy_semester_id) ON public.student_enrollments FROM authenticated;
GRANT INSERT(academic_year_id) ON public.student_enrollments TO authenticated;
COMMENT ON COLUMN public.student_enrollments.legacy_semester_id IS 'Read-only migration provenance. New annual validation rows leave this NULL. Never use for enrollment eligibility/filtering.';
COMMENT ON COLUMN public.student_enrollments.academic_year_id IS 'Student validation is annual and covers both semesters in this academic year.';
CREATE OR REPLACE FUNCTION lirc_private.guard_student_enrollment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
 IF NEW.status='enrolled' AND (NEW.year_level IS NULL OR
     ((expected IS NULL OR expected NOT BETWEEN 1 AND 10 OR NEW.year_level<>expected) AND NEW.year_level_note IS NULL)) THEN
  RAISE EXCEPTION 'Provide a verified year level and a reason when it differs from or cannot be estimated from the card.';
 END IF;
 NEW.updated_at:=now(); RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION lirc_private.guard_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
  IF enrollment.status<>'enrolled' OR enrollment.validated_at IS NULL OR enrollment.year_level IS NULL THEN
   RAISE EXCEPTION 'Student is not validated as enrolled for this academic year (status: %).', enrollment.status;
  END IF;
  NEW.student_enrollment_id:=enrollment.id; NEW.year_level:=enrollment.year_level;
  NEW.year_level_note:=enrollment.year_level_note;
 END IF;
 NEW.time_in:=clock_timestamp(); NEW.created_at:=NEW.time_in;
 NEW.time_out:=NULL; NEW.checked_out_by:=NULL; NEW.recorded_by:=staff;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_attendance_card(p_library_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
  'estimated_year_level',estimate,
  'enrollment',CASE WHEN enrollment.id IS NULL THEN NULL ELSE to_jsonb(enrollment) END,
  'open_visit',CASE WHEN visit.id IS NULL THEN NULL ELSE to_jsonb(visit) END);
END;
$$;

ALTER TABLE public.student_enrollments ENABLE TRIGGER guard_student_enrollment;
-- CREATE OR REPLACE preserves existing function grants, RLS and triggers.
REVOKE ALL ON FUNCTION lirc_private.guard_student_enrollment(),lirc_private.guard_attendance() FROM PUBLIC,anon,authenticated;
COMMIT;

-- Optional diagnostic if migration stopped for duplicate annual records:
-- SELECT e.user_profile_id,s.academic_year_id,array_agg(e.id) AS enrollment_ids
-- FROM public.student_enrollments e JOIN public.semesters s ON s.id=e.semester_id
-- GROUP BY e.user_profile_id,s.academic_year_id HAVING count(*)>1;
-- Run the annual seed script next, or configure real dates in the UI.
