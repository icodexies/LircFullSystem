// The shared glass/navy chrome used by the public auth pages:
// Register, Forgot password and Choose-new-password (reset).
// It keeps all three pages visually identical. Page-specific content goes
// inside <AuthShell> as children and appears in the form column.
import { Link } from "react-router-dom";
import { CONTACT_LINKS } from "../../data/shared/contactLinks.js";
import Reveal from "../ui/Reveal.jsx";

const NAV = [
  { label: "Home", to: "/" },
  { label: "About", to: "/#about" },
  { label: "Contact", to: "/#contact" },
];

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.5'/></svg>\")";

/* ---------- glass input (compact) ---------- */
export const inputWrap =
  "flex items-center rounded-lg border border-white/20 bg-white/[0.07] px-3 py-1.5 backdrop-blur-sm transition focus-within:border-white/70 focus-within:bg-white/[0.12]";
export const inputCls =
  "w-full bg-transparent text-[13px] text-white placeholder:text-white/35 focus:outline-none";
export const glassButton =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-[13px] font-medium text-navy transition hover:bg-[#E8EEFF] disabled:opacity-60";

export function Field({ label, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <div className={inputWrap}>
        <div className="w-full">
          <span className="block text-[9px] leading-tight text-white/60">
            {label}
          </span>
          {children}
        </div>
      </div>
    </label>
  );
}

/* ---------- glass spheres ---------- */
function Sphere({ className }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute rounded-full border border-white/30 ${className}`}
      style={{
        background:
          "radial-gradient(circle at 28% 22%, rgba(255,255,255,.65), transparent 18%), radial-gradient(circle at 50% 60%, rgba(108,127,216,.9) 0%, rgba(42,58,122,.92) 58%, rgba(11,19,48,.95) 100%)",
        boxShadow:
          "inset 0 0 50px rgba(232,238,255,.45), 0 30px 70px rgba(108,127,216,.35)",
      }}
    />
  );
}

function Spheres() {
  return (
    <>
      <Sphere className="right-[10%] top-0 h-[58%] w-[58%] opacity-90" />
      <Sphere className="bottom-[4%] left-0 h-[60%] w-[60%] opacity-95" />
      <Sphere className="bottom-[16%] right-0 h-[62%] w-[62%] opacity-85" />
    </>
  );
}

/* sharp shape inside the frame — sized by viewport height so it never overflows */
function GlassShape() {
  return (
    <div className="relative aspect-square h-[min(52vh,380px)]">
      <Spheres />
    </div>
  );
}

/* the same shape, zoomed in and blurred, fills the whole page background */
function BlurredBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-[62%] top-1/2 aspect-square w-[130vmax] -translate-x-1/2 -translate-y-1/2 opacity-90 blur-[70px]">
        <Spheres />
      </div>
      <div className="absolute inset-0 bg-[#060A1C]/45" />
    </div>
  );
}

/* ---------- small icons ---------- */
const UserIcon = () => (
  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10.5" />
    <circle cx="12" cy="9.5" r="3.5" />
    <path d="M5 19c1.5-3.2 4-4.5 7-4.5s5.5 1.3 7 4.5" />
  </svg>
);
const Facebook = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M13.5 21v-8h2.7l.5-3.2h-3.2V7.9c0-.9.4-1.6 1.7-1.6h1.6V3.5c-.3 0-1.3-.1-2.4-.1-2.5 0-4 1.500-4 4.200v2.200H7.500V13h2.900v8h3.100z" />
  </svg>
);
const Instagram = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
  </svg>
);

export default function AuthShell({ onLogin, children }) {
  return (
    <main className="theme-light relative h-[100dvh] w-full overflow-hidden bg-[#060A1C] p-3 sm:p-5">
      <BlurredBackdrop />

      {/* glass frame — fills the viewport, never taller than it */}
      <div className="relative mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-navy via-[#1B2760] to-[#2A3A7A] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_42%,rgba(108,127,216,0.55),transparent_55%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />

        {/* ---------- header ---------- */}
        <Reveal
          direction="down"
          distance={24}
          duration={700}
          once
          className="relative z-10 shrink-0"
        >
          <header className="flex items-center justify-between px-6 py-3 sm:px-10">
            <Link to="/" className="flex items-center gap-2.5">
              <img
                src="/images/auth/LIRC_Logo.webp"
                width="256"
                height="256"
                alt="LIRC logo"
                className="h-9 w-9 object-contain"
              />
              <span className="hidden text-lg font-semibold leading-tight text-white sm:block">
                Learning and Information Resource Center
              </span>
            </Link>

            <nav className="hidden items-center gap-7 text-xs text-white/90 md:flex">
              {NAV.map((n) => (
                <Link key={n.label} to={n.to} className="hover:text-white hover:underline">
                  {n.label}
                </Link>
              ))}
            </nav>

            <button
              type="button"
              onClick={onLogin}
              aria-label="Log in"
              className="text-white/90 transition hover:text-white"
            >
              <UserIcon />
            </button>
          </header>
        </Reveal>

        {/* ---------- body ---------- */}
        <section className="relative z-10 grid min-h-0 flex-1 items-center gap-6 overflow-y-auto px-6 py-2 sm:px-10 lg:grid-cols-2">
          {/* page column */}
          <div className="w-full max-w-xs">{children}</div>

          {/* glass shape column */}
          <div className="hidden items-center justify-center lg:flex">
            <Reveal direction="zoom" delay={300} duration={1100} once>
              <GlassShape />
            </Reveal>
          </div>
        </section>

        {/* ---------- footer ---------- */}
        {/* Not wrapped in <Reveal>: it sits inside Reveal's -80px bottom
            rootMargin, so the observer would never see it as visible. */}
        <footer className="relative z-10 shrink-0 bg-black/20 px-6 pb-2.5 pt-3 sm:px-10">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <img
              src="/images/auth/CCC_Logo.png"
              width="105"
              height="100"
              alt="City College of Calamba logo"
              className="h-7 w-7 object-contain"
            />
            <nav className="flex items-center gap-5 text-[11px] text-white/80">
              {NAV.map((n) => (
                <Link key={n.label} to={n.to} className="hover:text-white hover:underline">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3 text-white/90">
              <a href={CONTACT_LINKS.facebook || undefined} aria-disabled={!CONTACT_LINKS.facebook} aria-label="Facebook" title={!CONTACT_LINKS.facebook ? "Facebook is not configured yet" : undefined} className="hover:text-white">
                <Facebook />
              </a>
              <a href={CONTACT_LINKS.instagram || undefined} aria-disabled={!CONTACT_LINKS.instagram} aria-label="Instagram" title={!CONTACT_LINKS.instagram ? "Instagram is not configured yet" : undefined} className="hover:text-white">
                <Instagram />
              </a>
            </div>
          </div>
          <div className="mt-2 border-t border-white/25 pt-1.5 text-center text-[10px] text-white/55">
            © 2026 Learning Information Resource Center, City College of Calamba.
            All rights reserved.
          </div>
        </footer>
      </div>
    </main>
  );
}
