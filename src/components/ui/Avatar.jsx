// Profile image with the library's fallback: shows the chosen photo (or a
// preset) and fades smoothly to the default image when there is none or the
// source fails to load. Size comes from className.
import { useState } from "react";
import { FALLBACK_AVATAR } from "../../data/profileAvatars.js";

export default function Avatar({ src, alt = "", className = "h-9 w-9" }) {
  const [status, setStatus] = useState({
    src: null,
    failed: false,
    loaded: false,
  });
  const candidate = src || FALLBACK_AVATAR;
  const failed = status.failed && status.src === candidate;
  const resolved = failed ? FALLBACK_AVATAR : candidate;
  const loaded = status.loaded && status.src === resolved;

  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full border border-[#3B4A86]/10 bg-[#F0EDFA] ${className}`}
    >
      <img
        src={resolved}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() =>
          setStatus({ src: resolved, failed: false, loaded: true })
        }
        onError={() =>
          setStatus({
            src: resolved,
            failed: resolved !== FALLBACK_AVATAR,
            loaded: resolved === FALLBACK_AVATAR,
          })
        }
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}
