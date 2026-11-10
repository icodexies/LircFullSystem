-- ============================================================================
-- Staff notification for a new book reservation
--
-- Every reservation creates one in-app notification for every staff,
-- librarian and admin so the copy can be pulled from circulation and held at
-- the service desk. The notification deep-links to Book Borrow → Reservations.
-- ============================================================================
begin;

create or replace function lirc_private.notify_book_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member text;
  v_library_id text;
  v_book text;
  v_accession text;
  v_expires text;
begin
  if NEW.status <> 'active' then
    return NEW;
  end if;

  select lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix),
         u.library_id
    into v_member, v_library_id
  from public."usersData" u
  where u.id = NEW.user_profile_id;

  select b.book_name, a.accession_number
    into v_book, v_accession
  from public.books b
  join public.book_accession_numbers a on a.book_id = b.id
  where a.id = NEW.accession_id
    and b.id = NEW.book_id;

  v_expires := to_char(
    NEW.expires_at at time zone 'Asia/Manila',
    'Mon DD, YYYY HH12:MI AM'
  );

  insert into public.notifications
    (user_profile_id, type, title, message, link)
  select u.id,
         'reservation',
         'Book reservation for pickup',
         format(
           '%s (%s) reserved "%s" — copy %s. Hold it until %s.',
           v_member, v_library_id, v_book, v_accession, v_expires
         ),
         '/book-borrow?tab=reservations'
  from public."usersData" u
  where lower(btrim(u.role::text)) in ('staff', 'librarian', 'admin')
    and u.id <> NEW.user_profile_id;

  return NEW;
end $$;
revoke all on function lirc_private.notify_book_reservation()
  from public, anon, authenticated;

drop trigger if exists lirc_notify_book_reservation on public.book_reservations;
create trigger lirc_notify_book_reservation
  after insert on public.book_reservations
  for each row execute function lirc_private.notify_book_reservation();

notify pgrst, 'reload schema';
commit;
