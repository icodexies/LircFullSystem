import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogin } from "../../../hooks/auth/useLogin.js";
import { registerLibraryUser } from "../../../services/auth/authService.js";
import Reveal from "../../../components/ui/Reveal.jsx";
import AuthShell, {
  Field,
  inputCls,
  glassButton,
} from "../../../components/auth/AuthShell.jsx";
import { Spinner } from "../../../components/ui/Loading.jsx";

const DOMAIN = "@ccc.edu.ph";

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
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell onLogin={goLogin}>
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
              className={`mt-5 ${glassButton}`}
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
              className={`mt-3 ${glassButton}`}
            >
              {loading ? (
                <>
                  <Spinner size="sm" /> Creating account…
                </>
              ) : (
                "Register"
              )}
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
    </AuthShell>
  );
}

export default Register;
