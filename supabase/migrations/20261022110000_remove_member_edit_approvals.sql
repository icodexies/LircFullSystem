-- Remove the obsolete member-edit approval workflow.
--
-- Staff, librarians and admins now save member edits directly through
-- lirc_update_member (20261022109000). The old request table, request/review
-- functions, member-edit notifications and request/review activity entries are
-- no longer needed. Direct-edit activity (member_change.apply) is kept.
begin;

-- 1) Old member-edit notifications (not enrollment/validation notifications).
delete from public.notifications
where type in ('member_edit_request', 'member_edit_result');

-- 2) Request/review activity entries; the direct-edit apply event stays.
delete from public.activity_events
where action in ('member_change.request', 'member_change.review');

-- 3) Drop the approval functions before the table they depend on.
drop function if exists public.lirc_review_member_change(bigint, boolean);
drop function if exists public.lirc_member_change_requests(boolean);
drop function if exists public.lirc_request_member_change(bigint, jsonb);

-- 4) Drop the request table (one rejected historical row on the live project).
drop table if exists public.member_change_requests;

notify pgrst, 'reload schema';
commit;
