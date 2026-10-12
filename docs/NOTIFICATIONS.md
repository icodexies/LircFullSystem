# Notifications and the header bell

The system has a built-in notification feed: the **bell in the member header**
shows an unread badge, lists the newest alerts, and jumps to the related page
when one is clicked. Future features can add notifications with a single
server-side call — no new table or UI needed.

## How it works

```
A server action (approval request, approval result, ...)
        │  lirc_private.notify_profile(...) / notify_admins(...)
        ▼
public.notifications table  (one row per recipient)
        │  lirc_notification_feed()
        ▼
NotificationProvider (loads on login, refreshes every 45s)
        │
NotificationBell → badge, dropdown list, click = mark read + navigate(link)
```

## Where things live

| Piece | Location |
| --- | --- |
| Table + helpers + RPCs | migration `20261012160000_enrollment_approvals_and_notifications.sql` |
| Feed + mark-read service | `src/services/notifications/notificationService.js` |
| Provider (state + polling) | `src/context/notifications/NotificationProvider.jsx` |
| Hook | `src/hooks/shared/useNotifications.js` |
| Bell UI | `src/components/layout/member/NotificationBell.jsx` (used by `MemberHeader`) |

## Adding a notification from a future feature

Server-side only (inside a migration or an RPC). One recipient:

```sql
perform lirc_private.notify_profile(
  p_profile_id,          -- public."usersData".id of the receiver
  'approval_result',     -- a type label of your choice
  'Validation change approved',
  'Juan Dela Cruz — 2025-2026: now saved as graduated',
  '/enrollments'         -- app path the bell should open
);
```

Every admin at once (for things admins should act on):

```sql
perform lirc_private.notify_admins(
  'approval_request',
  'Validation change request',
  'Juan Dela Cruz — 2025-2026: change to graduated',
  '/enrollments'
);
```

The frontend never inserts notifications directly: the table is read-only for
users (select + mark own rows read), and writes happen only through the
server-side helpers.

## Current senders

| Action | Notification |
| --- | --- |
| A librarian submits a past-year validation change | Every admin ("Validation change request") |
| An admin approves or rejects it | The librarian who requested ("Validation change approved / rejected") |

## Feed rules

- Newest first, up to 20 items in the dropdown; the badge counts **all** unread.
- Clicking an alert marks it read and opens its `link`.
- "Mark all read" clears the badge.
- The provider refreshes shortly after login, every 45 seconds, and right
  after actions that create alerts. A read failure keeps the last state.
