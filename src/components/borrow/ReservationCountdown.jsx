import { useEffect, useRef, useState } from "react";

function remainingLabel(ms) {
  if (ms <= 0) return "Expired";
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// A live 1-hour hold countdown. The database expiry time is authoritative;
// this is only the display.
export default function ReservationCountdown({
  expiresAt,
  onExpire,
  className = "",
}) {
  const target = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const [now, setNow] = useState(() => Date.now());
  const expiredCalled = useRef(false);

  useEffect(() => {
    expiredCalled.current = false;
  }, [expiresAt]);

  useEffect(() => {
    if (!Number.isFinite(target)) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  const remaining = Number.isFinite(target) ? target - now : 0;
  useEffect(() => {
    if (remaining > 0 || expiredCalled.current) return;
    expiredCalled.current = true;
    onExpire?.();
  }, [remaining, onExpire]);

  if (!expiresAt) return null;
  return (
    <span className={className} aria-live="polite">
      {remainingLabel(remaining)}
    </span>
  );
}
