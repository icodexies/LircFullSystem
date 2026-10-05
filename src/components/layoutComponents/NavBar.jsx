import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import NavLinks from "../ui/NavLinks";
import Reveal from "../ui/Reveal";
import { useLogin } from "../../context/loginContext";


// The ids of the sections on your home page, in the order they appear.
// Make sure each one exists: <section id="collection"> and <section id="about">
const SECTION_IDS = ["collection", "about"];

const NAV_ITEMS = [
  { label: "Home", id: "home" },
  { label: "Collections", id: "collection" },
  { label: "About", id: "about" },
];


function scrollToId(id) {
  if (id === "home") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// One link in the middle of the navbar. Active = filled navy pill.
function NavItem({ href, active, onClick, children }) {
  return (
    <a
      href={href}
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-300 ${
        active
          ? "bg-[#0B1330] text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-[#0B1330]"
      }`}
    >
      {children}
    </a>
  );
}

function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
const { openLogin } = useLogin();
  // "home" | "collection" | "about" | null (null = on another page, like /login)
  const [active, setActive] = useState("home");

  /* ---------- Highlight the link of the section you're looking at ---------- */
  useEffect(() => {
    if (pathname !== "/") {
      setActive(null);
      return;
    }

    let raf = 0;

    const update = () => {
      raf = 0;
      const probe = window.innerHeight * 0.35; // a line 35% down the screen
      let current = "home";
      let lastFound = null;

      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        lastFound = id;
        const r = el.getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) current = id;
      }

      // At the very bottom of the page, keep the last section active
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && lastFound) current = lastFound;

      setActive(current);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    const t = setTimeout(update, 300); // re-check once the page content has rendered
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      clearTimeout(t);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  /* ---------- Coming from another page: go home, then scroll ---------- */
  useEffect(() => {
    const id = location.state?.scrollTo;
    if (pathname !== "/" || !id) return;

    const t = setTimeout(() => {
      scrollToId(id);
      navigate(pathname, { replace: true, state: null }); // clear it so a refresh doesn't re-scroll
    }, 80);

    return () => clearTimeout(t);
  }, [location, pathname, navigate]);

  /* ---------- Click handler for the 3 page links ---------- */
  const handleNav = (e, id) => {
    e.preventDefault();

    if (pathname !== "/") {
      navigate("/", { state: { scrollTo: id } });
      return;
    }
    scrollToId(id);
  };

  return (
    <header className="pointer-events-none sticky top-0 z-50 flex justify-center px-4 py-5">
      <Reveal direction="down" distance={24} duration={700} delay={0} easing="smooth">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 p-1.5 shadow-lg shadow-black/15 md:gap-3">
          {/* Logo / Brand (clicking it on the home page scrolls back to the top) */}
          <Link
            to="/"
            onClick={(e) => {
              if (pathname === "/") {
                e.preventDefault();
                scrollToId("home");
              }
            }}
            className="group flex items-center gap-2.5 pl-0.5 pr-2"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-[#0B1330]/15 transition-all duration-300 group-hover:scale-105 group-hover:ring-sky-400">
              <img
                src="/LIRC_LOGO.svg"
                alt="LIRC Logo"
                className="h-full w-full p-0.5 transition-transform duration-300 group-hover:rotate-6"
              />
            </div>

            {/* Very small screens: short name */}
            <span className="font-['Fraunces',serif] text-base font-bold tracking-tight text-[#0B1330] sm:hidden">
              LIRC
            </span>

            {/* sm and up: full name, one style, wrapped on two lines */}
            <span className="hidden items-center justify-center text-center font-['Fraunces',serif] text-[13px] font-bold leading-[1.15] tracking-tight text-[#0B1330] transition-colors duration-300 group-hover:text-sky-600 sm:flex">
              <span>
                Learning and Information
                <br />
                Resource Center
              </span>
            </span>
          </Link>

          {/* Divider */}
          <span aria-hidden="true" className="hidden h-5 w-px bg-slate-200 md:block" />

          {/* Navigation Links */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV_ITEMS.map(({ label, id }) => (
              <NavItem
                key={id}
                href={id === "home" ? "/" : `/#${id}`}
                active={active === id}
                onClick={(e) => handleNav(e, id)}
              >
                {label}
              </NavItem>
            ))}
          </nav>

          {/* Divider */}
          <span aria-hidden="true" className="hidden h-5 w-px bg-slate-200 md:block" />

          {/* Action Buttons */}
          <div className="flex items-center gap-0.5">
            <NavLinks
              variant="ghost"
              tone="light"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={openLogin}
            >
              Login
            </NavLinks>
            <NavLinks to="/register" variant="button" tone="light" size="sm">
              Get Started
            </NavLinks>
          </div>
        </div>
      </Reveal>
    </header>
  );
}

export default NavBar;