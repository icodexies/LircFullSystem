import { useState } from "react";
import { Link } from "react-router-dom";
import Reveal from "../ui/Reveal";
import BrandMark from "../ui/BrandMark";
import { useLogin } from "../../context/useLogin";
import { CONTACT_LINKS } from "../../data/contactLinks";

// 👉 Put the building image in /public/Home-Page-IMG/ and change this path if needed
const FOOTER_IMG = "/Home-Page-IMG/lirc-building.png";

const columns = [
  {
    title: "Library",
    links: [
      { label: "Home", to: "/" },
      { label: "About Us", to: "/#about" },
      { label: "Catalog", to: "/#collection" },
      { label: "Digitals", to: "/#digital-sources" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Login", action: "login" },
      { label: "Register", to: "/register" },
      { label: "Create", to: "/register" },
      { label: "Contact Us", to: "/#contact" },
    ],
  },
];

/* Every element gets its own Reveal. `step` spaces them out so they
   appear one after another instead of all at once. */
const BASE = 50; // ms before the first element
const STEP = 35; // ms between elements
const at = (i) => BASE + i * STEP;

function R({ i, children, distance = 22 }) {
  return (
    <Reveal direction="up" distance={distance} duration={500} delay={at(i)} easing="smooth">
      {children}
    </Reveal>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 text-sky-400 transition-transform duration-300 group-hover:translate-x-1"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M3 6.5v11A1.5 1.5 0 0 0 4.5 19H7V10.2l5 3.8 5-3.8V19h2.5a1.5 1.5 0 0 0 1.5-1.5v-11a1.5 1.5 0 0 0-2.4-1.2L12 10.9 5.4 5.3A1.5 1.5 0 0 0 3 6.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M14 8.5V6.9c0-.7.2-1.1 1.2-1.1H17V3h-2.4C12.2 3 11 4.4 11 6.6v1.9H9v3h2V21h3v-9.5h2.4L17 8.5z" />
    </svg>
  );
}

function SocialBox({ href, label, children }) {
  const className = "flex h-10 w-10 items-center justify-center border border-white/15 text-slate-300 transition-all duration-300 hover:-translate-y-1 hover:border-sky-400 hover:bg-sky-400 hover:text-[#0B1330] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400";

  if (!href) {
    return (
      <button type="button" disabled aria-label={`${label} (not configured yet)`} title={`${label} is not configured yet`} className={className}>
        {children}
      </button>
    );
  }
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

function ColumnHeading({ children }) {
  return (
    <h4 className="relative inline-block pb-2 text-sm font-semibold text-white">
      {children}
      <span className="absolute bottom-0 left-0 h-0.5 w-6 rounded-full bg-sky-400" />
    </h4>
  );
}

export default function Footer() {
  const { openLogin } = useLogin();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    // No subscription table exists yet. Do not pretend this was saved.
    setDone(true);
  };

  // running counter so each element gets the next delay slot
  let n = 0;
  const next = () => n++;

  return (
    <footer className="relative overflow-hidden bg-[#0B1330] text-slate-300">
      {/* soft glow + thin accent line on top */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/70 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-sky-400/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-4 lg:px-10">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_0.7fr_0.7fr_1.3fr] lg:gap-10">
          {/* Brand */}
          <div>
            <R i={next()}>
              <div className="group flex items-center gap-3">
                <BrandMark
                  className="h-12 w-12 bg-white ring-2 ring-sky-400"
                  imageClassName="transition-transform duration-300 group-hover:rotate-6"
                />
                <p className="font-['Fraunces',serif] text-lg font-bold leading-tight text-white">
                  Learning &amp; Information
                  <br />
                  Resource Center
                </p>
              </div>
            </R>

            <R i={next()}>
              <p className="mt-6 max-w-xs text-sm leading-relaxed">
                Giving students, faculty, and researchers of City College of Calamba
                access to reliable books, digital collections, and learning support.
              </p>
            </R>

            <div className="mt-6 flex gap-3">
              <R i={next()}>
                <SocialBox href={CONTACT_LINKS.email} label="Email"><GmailIcon /></SocialBox>
              </R>
              <R i={next()}>
                <SocialBox href={CONTACT_LINKS.facebook} label="Facebook"><FacebookIcon /></SocialBox>
              </R>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <R i={next()}>
                <ColumnHeading>{col.title}</ColumnHeading>
              </R>
              <ul className="mt-5 space-y-3">
                {col.links.map(({ label, to, action }) => (
                  <li key={label}>
                    <R i={next()}>
                      {action === "login" ? (
                        <button type="button" onClick={openLogin} className="group inline-flex items-center gap-2 text-sm transition-colors duration-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
                          <Chevron />{label}
                        </button>
                      ) : (
                        <Link to={to} className="group inline-flex items-center gap-2 text-sm transition-colors duration-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
                          <Chevron />{label}
                        </Link>
                      )}
                    </R>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Subscribe */}
          <div>
            <R i={next()}>
              <ColumnHeading>Library updates</ColumnHeading>
            </R>
            <R i={next()}>
              <p className="mt-5 text-sm leading-relaxed">
                Get notified about new arrivals, library announcements, and schedule
                changes, straight to your inbox.
              </p>
            </R>
            <R i={next()}>
              <form onSubmit={onSubmit} className="mt-5 flex overflow-hidden border border-white/15 transition-colors focus-within:border-sky-400">
                <label htmlFor="lirc-footer-email" className="sr-only">Email address</label>
                <input
                  id="lirc-footer-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setDone(false); }}
                  placeholder="Your email"
                  className="min-w-0 flex-1 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Subscribe"
                  className="group flex w-14 items-center justify-center bg-sky-400 text-[#0B1330] transition-colors hover:bg-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </form>
              <p role="status" className="mt-2 min-h-[1.25rem] text-xs text-sky-300">
                {done ? "Subscriptions are not available yet. Your email was not saved." : ""}
              </p>
            </R>
          </div>
        </div>

        {/* Bottom bar */}
        <R i={next()} distance={14}>
          <div className="mt-14 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-6 text-xs sm:flex-row">
            <p>
              © {new Date().getFullYear()} Learning and Information Resource Center. All rights reserved.
            </p>
            <p className="font-medium text-slate-400">City College of Calamba</p>
          </div>
        </R>
      </div>

      {/* Building image: sits below every element and runs flush to the bottom edge */}
      <Reveal direction="up" distance={32} duration={600} delay={at(next())} easing="smooth">
        <div className="relative mx-auto -mb-px mt-4 w-full max-w-5xl px-4 sm:px-8">
          <img
            src={FOOTER_IMG}
            alt="City College of Calamba LIRC building"
            loading="lazy"
            decoding="async"
            className="block w-full select-none opacity-40 [filter:brightness(0)_invert(1)]"
            style={{
              // fades the top and both sides so the drawing melts into the navy footer
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, #000 45%), linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%)",
              WebkitMaskComposite: "source-in",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, #000 45%), linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%)",
              maskComposite: "intersect",
            }}
          />
        </div>
      </Reveal>
    </footer>
  );
}
