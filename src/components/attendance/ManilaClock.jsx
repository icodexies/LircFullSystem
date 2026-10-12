import { useEffect, useState } from "react";
export default function ManilaClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time className="text-[11px] tabular-nums text-slate-500">
      {new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(now)}{" "}
      · Manila
    </time>
  );
}
