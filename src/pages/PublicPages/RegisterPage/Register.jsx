import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLogin } from "../../../context/useLogin";
import { registerLibraryUser } from "../../../services/authService";
import { CONTACT_LINKS } from "../../../data/contactLinks";
import Reveal from "../../../components/ui/Reveal";

const DOMAIN = "@ccc.edu.ph";

const NAV = [
  { label: "Home", to: "/" },
  { label: "About", to: "/#about" },
  { label: "Contact", to: "/#contact" },
];

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.5'/></svg>\")";

/* ---------- glass input (compact) ---------- */
const inputWrap =
  "flex items-center rounded-lg border border-white/20 bg-white/[0.07] px-3 py-1.5 backdrop-blur-sm transition focus-within:border-white/70 focus-within:bg-white/[0.12]";
const inputCls =
  "w-full bg-transparent text-[13px] text-white placeholder:text-white/35 focus:outline-none";

function Field({ label, className = "", children }) {
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

function Register() {
  const navigate = useNavigate();
  const { openLogin } = useLogin();

  const [form, setForm] = useState({
    first_name: "",
    surname: "",
    middle_initial: "",
    library_id: "",
    email: "",
  });
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const goLogin = () => {
    navigate("/");
    openLogin?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setShowHelp(false);

    setLoading(true);
    try {
      await registerLibraryUser(form);
      setDone(true);
    } catch (err) {
      setError(err?.message || "Registration failed. Please try again.");
      setShowHelp(err?.code === "record_mismatch");
      console.log("code:", err?.code, "| message:", err?.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#060A1C] p-3 sm:p-5">
      <BlurredBackdrop />

      {/* glass frame — fills the viewport, never taller than it */}
      <div className="relative mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-[#0B1330] via-[#1B2760] to-[#2A3A7A] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
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
                src="/Login/LIRC_Logo.webp"
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
              onClick={goLogin}
              aria-label="Log in"
              className="text-white/90 transition hover:text-white"
            >
              <UserIcon />
            </button>
          </header>
        </Reveal>

        {/* ---------- body ---------- */}
        <section className="relative z-10 grid min-h-0 flex-1 items-center gap-6 overflow-y-auto px-6 py-2 sm:px-10 lg:grid-cols-2">
          {/* form column */}
          <div className="w-full max-w-xs">
            {done ? (
              <div role="status">
                <Reveal direction="up" distance={32} once>
                  <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white">
                    Check your email
                  </h1>
                </Reveal>
                <Reveal direction="up" distance={32} delay={100} once>
                  <p className="mt-3 text-sm text-white/70">
                    We sent your password to{" "}
                    <b className="text-white">{form.email.trim().toLowerCase()}</b>.
                    Use that email and password to log in.
                  </p>
                  <p className="mt-2 text-xs text-white/50">
                    Can't find it? Check your spam folder.
                  </p>
                </Reveal>
                <Reveal direction="up" distance={32} delay={200} once>
                  <button
                    type="button"
                    onClick={goLogin}
                    className="mt-5 w-full rounded-lg bg-white py-2.5 text-[13px] font-medium text-[#0B1330] transition hover:bg-[#E8EEFF]"
                  >
                    Go to login
                  </button>
                </Reveal>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <Reveal direction="up" distance={32} delay={150} once>
                  <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white">
                    Registration
                  </h1>
                  <p className="mt-1.5 text-[11px] leading-snug text-white/60">
                    Enter the details on your library card. We'll email your
                    password once they match.
                  </p>
                </Reveal>

                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  <Reveal direction="up" distance={32} delay={250} once className="col-span-3">
                    <Field label="First name">
                      <input
                        type="text"
                        required
                        autoComplete="given-name"
                        maxLength={100}
                        value={form.first_name}
                        onChange={set("first_name")}
                        placeholder="Juan"
                        className={inputCls}
                      />
                    </Field>
                  </Reveal>

                  <Reveal direction="up" distance={32} delay={320} once className="col-span-2">
                    <Field label="Surname">
                      <input
                        type="text"
                        required
                        autoComplete="family-name"
                        maxLength={100}
                        value={form.surname}
                        onChange={set("surname")}
                        placeholder="Dela Cruz"
                        className={inputCls}
                      />
                    </Field>
                  </Reveal>

                  <Reveal direction="up" distance={32} delay={320} once>
                    <Field label="M.I.">
                      <input
                        type="text"
                        maxLength={2}
                        value={form.middle_initial}
                        onChange={set("middle_initial")}
                        placeholder="S"
                        className={`${inputCls} text-center uppercase`}
                      />
                    </Field>
                  </Reveal>

                  <Reveal direction="up" distance={32} delay={390} once className="col-span-3">
                    <Field label="Library ID">
                      <input
                        type="text"
                        required
                        maxLength={64}
                        value={form.library_id}
                        onChange={set("library_id")}
                        placeholder="2024-0001"
                        className={inputCls}
                      />
                    </Field>
                  </Reveal>

                  <Reveal direction="up" distance={32} delay={460} once className="col-span-3">
                    <Field label="School email">
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        maxLength={254}
                        value={form.email}
                        onChange={set("email")}
                        placeholder={`yourname${DOMAIN}`}
                        className={inputCls}
                      />
                    </Field>
                  </Reveal>
                </div>

                <Reveal direction="up" distance={32} delay={530} once>
                  <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[11px] text-white/80">
                    <input
                      type="checkbox"
                      required
                      checked={agree}
                      onChange={(e) => setAgree(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-white/40 bg-transparent accent-white"
                    />
                    I agree to the library's terms and conditions
                  </label>
                </Reveal>

                {/* Show the records help only when the function reports a mismatch. */}
                {error && (
                  <div role="alert" className="mt-2">
                    <p className="text-[11px] font-medium text-red-300">{error}</p>
                    {showHelp && (
                      <p className="mt-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[10px] leading-snug text-white/65">
                        Entered the right name and Library ID but still can't
                        register? There may be a mismatch in our records. Please
                        visit the{" "}
                        <b className="font-medium text-white/90">
                          LIRC library office
                        </b>{" "}
                        so the staff can check and update your information.
                      </p>
                    )}
                  </div>
                )}

                <Reveal direction="up" distance={32} delay={600} once>
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-3 w-full rounded-lg bg-white py-2.5 text-[13px] font-medium text-[#0B1330] transition hover:bg-[#E8EEFF] disabled:opacity-60"
                  >
                    {loading ? "Creating account..." : "Register"}
                  </button>

                  <p className="mt-3 text-[11px] text-white/80">
                    Already registered?{" "}
                    <button
                      type="button"
                      onClick={goLogin}
                      className="ml-1 underline underline-offset-2 hover:text-white"
                    >
                      Log in
                    </button>
                  </p>
                </Reveal>
              </form>
            )}
          </div>

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
              src="/Login/CCC_Logo.png"
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

export default Register;
