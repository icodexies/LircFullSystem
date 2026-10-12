-- Run AFTER lirc_migrate_annual_validation.sql, as postgres in Supabase SQL Editor.
-- This replaces the old semester-based seed script. Annual STUDENT validation only.
-- Creates 2022-2023 through 2026-2027, with two semesters per year.
-- Activates 1st Semester 2026-2027 and bulk-initializes STUDENTS ONLY for academic year 2026-2027.
-- This is a user-authorized initial assumption of enrollment, NOT registrar verification.
-- No historical enrollment or attendance is invented; no future-year validation is copied.
-- BEFORE RUNNING:
-- 1) Provisional calendar approved for setup: July 1 to January 15; January 16 to May 31.
--    Adjust these dates to the official calendar before recording attendance.
-- 2) Set v_validator_profile_id to the responsible admin/librarian usersData.id.
--    If left NULL, the script auto-resolves ONLY when exactly one eligible staff profile exists.
--    Discover eligible staff with:
-- SELECT id, first_name, surname, role FROM public."usersData"
-- WHERE lower(btrim(role)) IN ('admin','librarian') AND user_id IS NOT NULL;
-- 3) Check the initial estimated levels: 26=1,25=2,24=3,23=4,22=5.
--    Override returning/transferring/repeating students using the override table below.
-- Existing confirmed levels/statuses are preserved. Conflicting inactive statuses
-- stop this initialization rather than silently reclassifying students.

BEGIN;
CREATE TEMP TABLE lirc_seed_calendar (
 start_year integer NOT NULL,
 semester_name text NOT NULL,
 starts_on date,
 ends_on date,
 PRIMARY KEY (start_year,semester_name)
) ON COMMIT DROP;
-- Provisional dates; historical calendars may differ. January periods do not overlap.
INSERT INTO lirc_seed_calendar VALUES
(2022,'1st Semester',DATE '2022-07-01',DATE '2023-01-15'),
(2022,'2nd Semester',DATE '2023-01-16',DATE '2023-05-31'),
(2023,'1st Semester',DATE '2023-07-01',DATE '2024-01-15'),
(2023,'2nd Semester',DATE '2024-01-16',DATE '2024-05-31'),
(2024,'1st Semester',DATE '2024-07-01',DATE '2025-01-15'),
(2024,'2nd Semester',DATE '2025-01-16',DATE '2025-05-31'),
(2025,'1st Semester',DATE '2025-07-01',DATE '2026-01-15'),
(2025,'2nd Semester',DATE '2026-01-16',DATE '2026-05-31'),
(2026,'1st Semester',DATE '2026-07-01',DATE '2027-01-15'),
(2026,'2nd Semester',DATE '2027-01-16',DATE '2027-05-31');

-- Optional verified year-level corrections. Use actual profile IDs.
CREATE TEMP TABLE lirc_initial_year_overrides (
 user_profile_id bigint PRIMARY KEY,
 year_level smallint NOT NULL CHECK (year_level BETWEEN 1 AND 10),
 reason text NOT NULL CHECK (length(btrim(reason))>0)
) ON COMMIT DROP;
-- Example shape only, NOT executed:
-- INSERT INTO lirc_initial_year_overrides VALUES (12345,4,'Verified returning student; did not advance during leave');

DO $$
DECLARE
 v_validator_profile_id bigint := NULL; -- Set explicitly if multiple eligible staff profiles exist.
 v_staff_auth_id uuid;
 v_staff_count integer;
 v_semester_id bigint;
 v_academic_year_id bigint;
 v_affected integer;
 v_unresolved integer;
BEGIN
 IF EXISTS (SELECT 1 FROM lirc_seed_calendar WHERE starts_on IS NULL OR ends_on IS NULL) THEN
  RAISE EXCEPTION 'Fill the NULL start/end dates with the school calendar before running this seed script. Nothing was saved.';
 END IF;
 IF EXISTS (SELECT 1 FROM lirc_seed_calendar WHERE ends_on<starts_on OR extract(year FROM starts_on) NOT BETWEEN start_year AND start_year+1
    OR extract(year FROM ends_on) NOT BETWEEN start_year AND start_year+1) THEN
  RAISE EXCEPTION 'Calendar dates are invalid for their academic year.';
 END IF;
 IF v_validator_profile_id IS NULL THEN
  SELECT count(*),min(id) INTO v_staff_count,v_validator_profile_id FROM public."usersData"
  WHERE lower(btrim(role)) IN ('admin','librarian') AND user_id IS NOT NULL;
  IF v_staff_count<>1 THEN
   RAISE EXCEPTION 'Found % eligible staff profiles. Set v_validator_profile_id to the responsible admin/librarian usersData.id.',v_staff_count;
  END IF;
 END IF;
 SELECT user_id INTO v_staff_auth_id FROM public."usersData"
 WHERE id=v_validator_profile_id AND lower(btrim(role)) IN ('admin','librarian') AND user_id IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Validator must be an admin/librarian linked to a Supabase Auth account.'; END IF;
 IF (clock_timestamp() AT TIME ZONE 'Asia/Manila')::date NOT BETWEEN
    (SELECT starts_on FROM lirc_seed_calendar WHERE start_year=2026 AND semester_name='1st Semester') AND
    (SELECT ends_on FROM lirc_seed_calendar WHERE start_year=2026 AND semester_name='1st Semester') THEN
  RAISE EXCEPTION 'Current Manila date is outside the supplied 1st Semester 2026-2027 dates.';
 END IF;

 -- Staff attribution required by the existing validation trigger. Local to this
 -- postgres transaction; no Auth accounts, passwords, or usersData roles are changed.
 PERFORM set_config('request.jwt.claim.sub',v_staff_auth_id::text,true);

 INSERT INTO public.academic_years(start_year,starts_on,ends_on)
 SELECT start_year,min(starts_on),max(ends_on) FROM lirc_seed_calendar GROUP BY start_year
 ORDER BY start_year ON CONFLICT(start_year) DO NOTHING;
 -- Reuse matching existing periods; never overwrite their dates.
 IF EXISTS(SELECT 1 FROM lirc_seed_calendar c JOIN public.academic_years a ON a.start_year=c.start_year
     WHERE c.starts_on<a.starts_on OR c.ends_on>a.ends_on) THEN
  RAISE EXCEPTION 'Seed dates fall outside an existing academic year. Resolve the calendar mismatch first.';
 END IF;
 IF EXISTS(SELECT 1 FROM lirc_seed_calendar c JOIN public.academic_years a ON a.start_year=c.start_year
     JOIN public.semesters s ON s.academic_year_id=a.id AND s.name=c.semester_name
     WHERE (s.starts_on,s.ends_on) IS DISTINCT FROM (c.starts_on,c.ends_on)) THEN
  RAISE EXCEPTION 'An existing semester has different dates. Resolve that mismatch before seeding.';
 END IF;
 INSERT INTO public.semesters(academic_year_id,name,starts_on,ends_on)
 SELECT a.id,c.semester_name,c.starts_on,c.ends_on FROM lirc_seed_calendar c
 JOIN public.academic_years a ON a.start_year=c.start_year
 ORDER BY c.start_year,c.starts_on ON CONFLICT(academic_year_id,name) DO NOTHING;
 SELECT s.id INTO v_semester_id FROM public.semesters s
 JOIN public.academic_years a ON a.id=s.academic_year_id
 WHERE a.start_year=2026 AND s.name='1st Semester';
 SELECT id INTO v_academic_year_id FROM public.academic_years WHERE start_year=2026;

 IF EXISTS(SELECT 1 FROM lirc_initial_year_overrides o LEFT JOIN public."usersData" u ON u.id=o.user_profile_id
     WHERE u.id IS NULL OR lower(btrim(u.role))<>'student') THEN
  RAISE EXCEPTION 'Year-level overrides must reference existing student profiles.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.student_enrollments e JOIN public."usersData" u ON u.id=e.user_profile_id
    WHERE e.academic_year_id=v_academic_year_id AND lower(btrim(u.role))='student'
      AND e.status IN ('leave_of_absence','withdrawn','graduated')) THEN
  RAISE EXCEPTION 'Some current-academic-year students already have confirmed inactive statuses. Review them before bulk initialization; they were not overwritten.';
 END IF;

 SELECT count(*) INTO v_unresolved FROM public."usersData" u
 LEFT JOIN public.student_enrollments e ON e.user_profile_id=u.id AND e.academic_year_id=v_academic_year_id
 LEFT JOIN lirc_initial_year_overrides o ON o.user_profile_id=u.id
 WHERE lower(btrim(u.role))='student' AND (e.id IS NULL OR e.status='unverified')
 AND (CASE WHEN o.user_profile_id IS NOT NULL THEN o.year_level
     WHEN u.library_id ~ '^[0-9]{2}-' THEN 2026-(2000+substring(u.library_id FROM 1 FOR 2)::integer)+1
     ELSE NULL END IS NULL
   OR CASE WHEN o.user_profile_id IS NOT NULL THEN o.year_level
     WHEN u.library_id ~ '^[0-9]{2}-' THEN 2026-(2000+substring(u.library_id FROM 1 FOR 2)::integer)+1
     ELSE NULL END NOT BETWEEN 1 AND 10);
 IF v_unresolved>0 THEN
  RAISE EXCEPTION '% student(s) need manual year-level overrides before all can be initialized. Nothing was saved.',v_unresolved;
 END IF;

 -- Only students are inserted. Existing enrolled records retain verified levels.
 INSERT INTO public.student_enrollments(user_profile_id,academic_year_id,status,year_level,year_level_note,validation_reference)
 SELECT u.id,v_academic_year_id,'enrolled',
   coalesce(o.year_level,CASE WHEN u.library_id ~ '^[0-9]{2}-'
     THEN 2026-(2000+substring(u.library_id FROM 1 FOR 2)::integer)+1 ELSE NULL END),
   coalesce(o.reason,'Initial year level estimated from admission prefix; staff must correct exceptions.'),
   'One-time initial validation of existing students authorized by library administrator; enrollment assumed for initial 2026-2027 academic-year setup.'
 FROM public."usersData" u
 LEFT JOIN lirc_initial_year_overrides o ON o.user_profile_id=u.id
 WHERE lower(btrim(u.role))='student'
 ON CONFLICT(user_profile_id,academic_year_id) DO UPDATE SET
   status=EXCLUDED.status,year_level=EXCLUDED.year_level,
   year_level_note=EXCLUDED.year_level_note,validation_reference=EXCLUDED.validation_reference
 WHERE student_enrollments.status='unverified';
 GET DIAGNOSTICS v_affected=ROW_COUNT;
 PERFORM public.set_active_semester(v_semester_id);
 RAISE NOTICE 'Created/initialized % student enrollment records. Active semester ID: %. Annual validation covers both semesters of 2026-2027. Existing confirmed enrollments preserved.',v_affected,v_semester_id;
END;
$$;
-- Summary: at completion all existing students should be enrolled in this term,
-- unless the transaction stopped for a conflict needing manual resolution.
SELECT a.name AS academic_year,s.name AS semester,s.is_active,s.starts_on,s.ends_on
FROM public.semesters s JOIN public.academic_years a ON a.id=s.academic_year_id
ORDER BY a.start_year,s.starts_on;
SELECT e.status,count(*) AS student_count FROM public.student_enrollments e
JOIN public.academic_years a ON a.id=e.academic_year_id
JOIN public."usersData" u ON u.id=e.user_profile_id
WHERE a.start_year=2026 AND lower(btrim(u.role))='student'
GROUP BY e.status;
COMMIT;

-- Switching to 2nd Semester 2026-2027 keeps the same annual validation.
-- Next ACADEMIC YEAR: missing annual enrollment records mean unverified.
-- DO NOT copy/automatically validate students for the new academic year.
-- Old annual enrollment and attendance history remain unchanged.
