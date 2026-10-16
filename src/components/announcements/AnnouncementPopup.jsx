// The announcement popup: a medium carousel in the middle of the page that
// appears when a member opens the system after signing in (once per member
// per browser session — a shared computer shows it to each person who signs
// in). Admins manage announcements on their own page and never get the
// popup. Failures stay silent — announcements must never block the app.
import { useEffect, useState } from "react";
import { ROLES } from "../../routes/roles.js";
import { getAnnouncementFeed } from "../../services/announcements/announcementService.js";
import AnnouncementCarousel from "./AnnouncementCarousel.jsx";

const SEEN_KEY = "lirc-announcements-shown";

export default function AnnouncementPopup({ role, memberKey }) {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (role === ROLES.ADMIN) return;
    const seenKey = `${SEEN_KEY}:${memberKey ?? "member"}`;
    try {
      if (window.sessionStorage.getItem(seenKey)) return;
    } catch {
      // Storage can be blocked; the popup still shows once per mount.
    }
    const controller = new AbortController();
    let active = true;
    getAnnouncementFeed(controller.signal)
      .then((rows) => {
        if (!active || !rows?.length) return;
        try {
          window.sessionStorage.setItem(seenKey, "1");
        } catch {
          // ignore
        }
        setItems(rows);
        setOpen(true);
      })
      .catch(() => {
        // Silent: a missing feed never blocks the workspace.
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [role, memberKey]);

  if (!open || !items?.length) return null;
  return (
    <AnnouncementCarousel items={items} onClose={() => setOpen(false)} />
  );
}
