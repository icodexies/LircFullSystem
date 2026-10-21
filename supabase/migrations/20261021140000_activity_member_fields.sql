-- ============================================================================
-- Audit completeness for direct member edits
--
-- Staff now save member edits without approval, so the activity log must
-- record every editable field. The usersData whitelist only covered role,
-- card, department, program and position; name parts and the person status
-- were silently skipped by the change capture. Add them.
-- ============================================================================
begin;

create or replace function lirc_private.activity_whitelist(p_table text)
returns text[]
language sql
immutable
as $$
  select case p_table
    when 'usersData' then
      array['role', 'library_id', 'department_id', 'program_id',
            'position_classification_id', 'first_name', 'surname',
            'middle_initial', 'suffix', 'person_status']::text[]
    when 'student_enrollments' then
      array['status', 'year_level', 'year_level_source',
            'academic_year_id', 'validated_by']::text[]
    when 'attendance' then
      array['time_in', 'time_out', 'purpose_of_visit', 'role_at_visit',
            'year_level', 'semester_id']::text[]
    when 'semesters' then
      array['name', 'starts_on', 'ends_on', 'is_active', 'academic_year_id']::text[]
    when 'academic_years' then
      array['name', 'start_year', 'starts_on', 'ends_on']::text[]
    when 'books' then
      array['book_name', 'author', 'isbn', 'call_number', 'publish_year',
            'edition', 'publisher', 'place_of_publication',
            'barcode_tag_number', 'asset_number', 'shelf_id',
            'book_format_id']::text[]
    when 'book_accession_numbers' then
      array['accession_number', 'status', 'condition', 'shelf_id',
            'book_id']::text[]
    when 'book_loans' then
      array['borrowed_at', 'due_at', 'returned_at', 'user_profile_id',
            'accession_id', 'returned_by']::text[]
    when 'inventory_sessions' then
      array['name', 'year', 'status', 'finished_by', 'paused_by']::text[]
    when 'inventory_entries' then
      array['outcome', 'condition', 'voided_at', 'voided_reason']::text[]
    when 'barcode_entries' then
      array['accession_number', 'template_id', 'templated_at']::text[]
    when 'barcode_templates' then
      array['name', 'item_count']::text[]
    else '{}'::text[]
  end;
$$;
revoke all on function lirc_private.activity_whitelist(text)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
