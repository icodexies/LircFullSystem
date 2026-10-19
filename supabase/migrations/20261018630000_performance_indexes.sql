-- Performance: targeted indexes for the slowest reads measured in
-- production (October 2026).
--
--   loans_borrowed_at_idx  — the statistics and report functions all filter
--                            loans by "borrowed_at between semester dates".
--   attendance_time_in_idx — the same for visits.
--   books_home_order_idx   — the home page collection orders the catalog by
--                            "has a cover first, then a stable hash"; this
--                            functional index answers that order directly.
-- ============================================================================
begin;

create index if not exists loans_borrowed_at_idx
  on public.book_loans (borrowed_at);

create index if not exists attendance_time_in_idx
  on public.attendance (time_in);

create index if not exists books_home_order_idx
  on public.books ((book_image is not null) desc, md5(id::text));

-- Let the planner pick the new indexes up right away.
analyze public.book_loans;
analyze public.attendance;
analyze public.books;

notify pgrst, 'reload schema';
commit;
