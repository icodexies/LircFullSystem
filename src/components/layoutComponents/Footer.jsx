import { Link } from "react-router-dom";
import Reveal from "../ui/Reveal";

// 👉 Put your footer image in /public and change this path (or import it from assets)
const FOOTER_BG = "/Home-Page-IMG/Footer-img.webp";

// 👉 Change these to your real contact links
const FACEBOOK_URL = "https://facebook.com/";
const EMAIL = "mailto:lirc@example.com";

const linkClass =
  "inline-block text-sm font-medium text-slate-300 transition-all duration-300 hover:translate-x-1 hover:text-white";

// Underlined column heading, like the reference
const headingClass =
  "border-b border-white/70 pb-2 text-base font-bold tracking-wide text-white";

const columns = [
  {
    title: "Navigate",
    links: [
      ["Home", "/"],
      ["About Us", "/about"],
      ["Catalog", "/catalog"],
      ["Digitals", "/digitals"],
    ],
  },
  {
    title: "Account",
    links: [
      ["Login", "/login"],
      ["Register", "/register"],
      ["Create", "/createTask"],
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*                                Small pieces                                */
/* -------------------------------------------------------------------------- */

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
      <path d="M3 6.5v11A1.5 1.5 0 0 0 4.5 19H7V10.2l5 3.8 5-3.8V19h2.5a1.5 1.5 0 0 0 1.5-1.5v-11a1.5 1.5 0 0 0-2.4-1.2L12 10.9 5.4 5.3A1.5 1.5 0 0 0 3 6.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
      <path d="M14 8.5V6.9c0-.7.2-1.1 1.2-1.1H17V3h-2.4C12.2 3 11 4.4 11 6.6v1.9H9v3h2V21h3v-9.5h2.4L17 8.5z" />
    </svg>
  );
}

function SocialButton({ href, label, children }) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noreferrer"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/70 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-[#0B1330]"
    >
      {children}
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Footer                                   */
/* -------------------------------------------------------------------------- */

export default function Footer() {
  return (
    <footer className="w-full">
      <Reveal direction="up" distance={24} duration={700} delay={0} easing="smooth">
        <div className="relative overflow-hidden bg-white">
          {/* ---------- Background image: natural proportions, pinned to the bottom ---------- */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0">
            <img
              src={FOOTER_BG}
              alt=""
              loading="lazy"
              decoding="async"
              className="block h-150 w-full select-none"
              style={{
                // fades the top edge of the image into the white page
                WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 40%)",
                maskImage: "linear-gradient(to bottom, transparent 0%, #000 40%)",
              }}
            />
          </div>

          {/* Extra white fade at the very top, in case the image is taller than the footer and gets cropped */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white via-white/70 to-transparent"
          />

          {/* Navy fade at the bottom so the text stays readable.
              Make h-[60%] smaller to show more of the image, bigger to show less. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-[#0B1330] via-[#0B1330]/85 to-transparent"
          />

          <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10">
            {/* ---------- Space reserved for the artwork ----------
                Your image shows through here. Change the heights to give it more
                or less room. */}
            <div aria-hidden="true" className="h-30" />

            {/* ---------- Main content ---------- */}
            <div className="grid gap-10 pb-10 lg:grid-cols-[1.25fr_0.8fr_0.8fr_1.4fr] lg:gap-12">
              {/* Brand + socials + contact */}
              <div className="group">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-sky-400 transition-all duration-300 group-hover:scale-105">
                    <img
                      src="/LIRC_LOGO.svg"
                      alt="LIRC Logo"
                      className="h-full w-full p-0.5 transition-transform duration-300 group-hover:rotate-6"
                    />
                  </div>
                  <h3 className="font-['Fraunces',serif] text-xl font-bold leading-tight text-white">
                    Learning &amp; Information Resource Center
                  </h3>
                </div>

                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-300">
                  City College of Calamba
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <SocialButton href={EMAIL} label="Email">
                    <GmailIcon />
                  </SocialButton>
                  <SocialButton href={FACEBOOK_URL} label="Facebook">
                    <FacebookIcon />
                  </SocialButton>

                  <Link
                    to="/contact"
                    className="ml-1 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#0B1330] transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-300"
                  >
                    Contact Us
                  </Link>
                </div>
              </div>

              {/* Link columns (side by side on mobile, separate grid columns on desktop) */}
              <div className="grid grid-cols-2 gap-8 lg:contents">
                {columns.map((col) => (
                  <div key={col.title}>
                    <h4 className={headingClass}>{col.title}</h4>
                    <ul className="mt-4 space-y-2.5">
                      {col.links.map(([label, to]) => (
                        <li key={to}>
                          <Link to={to} className={linkClass}>
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* About the library (right-aligned on desktop, like the reference) */}
              <div className="lg:text-right">
                <h4 className="text-base font-bold tracking-wide text-white lg:ml-auto">
                  About the Library
                </h4>
                <p className="mt-3 font-['Fraunces',serif] text-sm font-semibold text-sky-300">
                  Learning and Information Resource Center (LIRC)
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-300 lg:ml-auto lg:max-w-sm">
                  The Learning and Information Resource Center provides students,
                  faculty members, and researchers with access to reliable academic
                  resources, digital collections, and learning support services that
                  foster lifelong learning and academic excellence.
                </p>
              </div>
            </div>

            {/* ---------- Divider + bottom bar ---------- */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-white/15 py-5 text-xs text-slate-300 sm:flex-row">
              <p className="font-['Fraunces',serif] text-base font-bold tracking-tight text-white">
                LIRC
              </p>
              <p className="text-center">
                © {new Date().getFullYear()} Learning and Information Resource
                Center. All rights reserved.
              </p>
              <p className="font-medium">City College of Calamba</p>
            </div>
          </div>
        </div>
      </Reveal>
    </footer>
  );
}
