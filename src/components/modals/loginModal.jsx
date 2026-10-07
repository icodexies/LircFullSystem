import { useEffect, useState } from "react";
import Reveal from "../ui/Reveal";
import { REVEAL_EASINGS } from "../ui/revealEasings";

const EXIT_MS = 350; // keep in sync with the exit transitions below

/**
 * LoginModal
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onSubmit: ({ email, password, remember }) => Promise<void> | void
 *  - onRegister: () => void
 *  - onForgot: () => void
 *  - brand: string (name shown in "New to ...?")
 *  - avatarSrc, logoLeftSrc, logoRightSrc: image paths
 */
function LoginModal({
  open,
  onClose,
  onSubmit,
  onRegister,
  onForgot,
  brand = "LIRC",
  avatarSrc,
  logoLeftSrc,
  logoRightSrc,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // render = is it in the DOM, shown = backdrop visible, closing = card exit animation
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      // Keep the modal mounted through its exit animation before allowing re-entry.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRender(true);
      setClosing(false);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    if (render) {
      setClosing(true);
      setShown(false);
      const t = setTimeout(() => {
        setRender(false);
        setClosing(false);
      }, EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!render) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit?.({ email, password, remember });
    } catch (err) {
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputWrap =
    "flex items-center gap-3 rounded-xl border border-[#E4DDF5] bg-[#F7F4FF] px-4 py-3 focus-within:border-[#0B1330] focus-within:ring-2 focus-within:ring-[#0B1330]/15";

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 pt-14 ${
        closing ? "pointer-events-none" : ""
      }`}
      style={{
        opacity: shown ? 1 : 0,
        transition: `opacity ${EXIT_MS}ms ease`,
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
    >
      <div
        className="w-full max-w-sm"
        style={{
          opacity: closing ? 0 : 1,
          transform: closing ? "translateY(24px) scale(0.96)" : "none",
          transition: `opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1)`,
        }}
      >
      <Reveal
        direction="zoomUp"
        distance={40}
        duration={600}
        easing={REVEAL_EASINGS.bounce}
        threshold={0}
        once
        className="w-full max-w-sm"
      >
      <div className="relative w-full">
        {/* Avatar tab on top */}
        <div className="absolute -top-12 left-1/2 z-10 h-14 w-24 -translate-x-1/2 overflow-hidden rounded-t-2xl bg-[#E8EEFF]">
          {avatarSrc && (
            <img
              src={avatarSrc}
              width="120"
              height="90"
              alt=""
              className="h-full w-full object-cover object-top"
            />
          )}
        </div>

        {/* Card with offset navy shadow */}
        <form
          onSubmit={handleSubmit}
          className="relative rounded-3xl border-2 border-[#0B1330] bg-white px-7 pb-6 pt-8 shadow-[8px_8px_0_#0B1330]"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-3 text-xl leading-none text-[#0B1330]/50 hover:text-[#0B1330]"
          >
            ×
          </button>

          {/* Logos */}
          <div className="mb-5 flex items-center justify-center gap-4">
            {logoLeftSrc && (
              <img src={logoLeftSrc} width="256" height="256" alt="" className="h-14 w-14 object-contain" />
            )}
            {logoRightSrc && (
              <img src={logoRightSrc} width="105" height="100" alt="" className="h-14 w-14 object-contain" />
            )}
          </div>

          <h2
            id="login-title"
            className="font-serif text-3xl font-bold leading-tight text-[#0B1330]"
          >
            Welcome, City
            <br />
            Scholars!
          </h2>
          <p className="mt-2 text-xs text-[#0B1330]/60">
            Ready to jump back into your favorite stories?
          </p>

          {/* Email */}
          <label className="mt-6 block">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#0B1330]">
              Your Email
            </span>
            <div className={`${inputWrap} mt-1`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#0B1330]" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reader@lirc.edu"
                className="w-full bg-transparent text-sm text-[#0B1330] placeholder:text-[#0B1330]/40 focus:outline-none"
              />
            </div>
          </label>

          {/* Password */}
          <label className="mt-4 block">
            <span className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#0B1330]">
                Your Password
              </span>
              <button
                type="button"
                onClick={onForgot}
                className="text-[10px] font-semibold text-[#0B1330] underline"
              >
                Forgot?
              </button>
            </span>
            <div className={`${inputWrap} mt-1`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#0B1330]" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <input
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-sm text-[#0B1330] placeholder:text-[#0B1330]/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="text-[#0B1330]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPw && <path d="M4 4l16 16" />}
                </svg>
              </button>
            </div>
          </label>

          {/* Remember */}
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-[#0B1330]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#0B1330]"
            />
            Keep me logged in for month
          </label>

          {error && (
            <p className="mt-3 text-xs font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          {/* Login button */}
          <button
            type="submit"
            disabled={loading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B1330] py-3 text-xs font-bold uppercase tracking-widest text-white shadow-[0_4px_0_#3B4A86] transition active:translate-y-0.5 active:shadow-[0_2px_0_#3B4A86] disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="mt-4 text-center text-[11px] text-[#0B1330]/70">
            New to {brand}?{" "}
            <button
              type="button"
              onClick={onRegister}
              className="font-bold text-[#0B1330] underline"
            >
              Create an account
            </button>
          </p>
        </form>
      </div>
      </Reveal>
      </div>
    </div>
  );
}

export default LoginModal;
