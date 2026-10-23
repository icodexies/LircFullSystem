// Token-based registration:
//   1. Enter a CCC email; the server emails a one-time /register?token=... link.
//   2. The link asks for library ID + first name + surname + middle initial and
//      checks them against the existing library roster.
//   3. If they match, the visitor sets and confirms a password.
//   4. Submitting creates the auth account, links the existing profile, and
//      signs the new account in.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLogin } from "../../../hooks/auth/useLogin.js";
import {
  completeRegistration,
  login,
  matchRegistrationIdentity,
  requestRegistrationLink,
  verifyRegistrationToken,
} from "../../../services/auth/authService.js";
import Reveal from "../../../components/ui/Reveal.jsx";
import AuthShell, {
  Field,
  inputCls,
  glassButton,
} from "../../../components/auth/AuthShell.jsx";
import { Spinner } from "../../../components/ui/Loading.jsx";

const DOMAIN = "@ccc.edu.ph";
const EMPTY_IDENTITY = {
  library_id: "",
  first_name: "",
  surname: "",
  middle_initial: "",
};

function Register() {
  const navigate = useNavigate();
  const { openLogin } = useLogin();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [step, setStep] = useState(token ? "checking" : "request");
  const [emailInput, setEmailInput] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [identity, setIdentity] = useState(EMPTY_IDENTITY);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);

  const checks = [
    { ok: password.length >= 8, label: "At least 8 characters" },
    { ok: password.length > 0 && password.length <= 72, label: "72 characters or fewer" },
    { ok: /[A-Z]/.test(password), label: "One uppercase letter" },
    { ok: /[a-z]/.test(password), label: "One lowercase letter" },
    { ok: /\d/.test(password), label: "One number" },
    { ok: Boolean(confirm) && password === confirm, label: "Passwords match" },
  ];
  const passwordReady = checks.every((check) => check.ok);

  useEffect(() => {
    if (!token) return;
    let active = true;
    verifyRegistrationToken(token)
      .then((result) => {
        if (!active) return;
        setVerifiedEmail(result.email ?? "");
        setStep(result.identity_verified ? "password" : "identity");
        setError("");
      })
      .catch((problem) => {
        if (!active) return;
        setError(problem.message);
        setStep("request");
      });
    return () => {
      active = false;
    };
  }, [token]);

  const goLogin = () => {
    navigate("/");
    openLogin?.();
  };

  const reset = () => {
    setStep("request");
    setEmailInput("");
    setVerifiedEmail("");
    setIdentity(EMPTY_IDENTITY);
    setPassword("");
    setConfirm("");
    setError("");
    setHelp(false);
    if (token) navigate("/register", { replace: true });
  };

  async function requestLink(event) {
    event.preventDefault();
    if (loading) return;
    const email = emailInput.trim().toLowerCase();
    if (!/^[^\s@]+@ccc\.edu\.ph$/.test(email)) {
      setError(`Use your CCC email ending in ${DOMAIN}.`);
      setHelp(false);
      return;
    }
    setLoading(true);
    setError("");
    setHelp(false);
    try {
      if (token) navigate("/register", { replace: true });
      await requestRegistrationLink(email);
      setVerifiedEmail(email);
      setStep("sent");
    } catch (problem) {
      setError(problem.message || "Couldn't send the registration link.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyIdentity(event) {
    event.preventDefault();
    if (loading) return;
    if (
      !identity.library_id.trim() ||
      !identity.first_name.trim() ||
      !identity.surname.trim() ||
      !identity.middle_initial.trim()
    ) {
      setError("Fill in your library ID, first name, surname and middle initial.");
      setHelp(false);
      return;
    }
    setLoading(true);
    setError("");
    setHelp(false);
    try {
      const result = await matchRegistrationIdentity(token, identity);
      setVerifiedEmail(result.email ?? verifiedEmail);
      setStep("password");
    } catch (problem) {
      setError(problem.message || "Those details did not match.");
      setHelp(problem.code === "record_mismatch");
    } finally {
      setLoading(false);
    }
  }

  async function createAccount(event) {
    event.preventDefault();
    if (loading || !passwordReady) return;
    setLoading(true);
    setError("");
    setHelp(false);
    try {
      const result = await completeRegistration(token, password);
      const email = result.email ?? verifiedEmail;
      try {
        await login({ email, password, remember: false });
        navigate("/dashboard", { replace: true });
      } catch {
        setVerifiedEmail(email);
        setStep("done");
      }
    } catch (problem) {
      setError(problem.message || "Couldn't create your account.");
    } finally {
      setLoading(false);
    }
  }

  const header = (title, copy) => (
    <Reveal direction="up" distance={28} once>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white">
        {title}
      </h1>
      <p className="mt-1.5 text-[11px] leading-snug text-white/60">{copy}</p>
    </Reveal>
  );

  const errorBox = error ? (
    <div role="alert" className="mt-3">
      <p className="text-[11px] font-medium text-red-300">{error}</p>
      {help && (
        <p className="mt-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[10px] leading-snug text-white/65">
          Entered the right name and Library ID but still can't register? The
          record may differ from the card. Please visit the{" "}
          <b className="font-medium text-white/90">LIRC library office</b> so the
          staff can check it.
        </p>
      )}
    </div>
  ) : null;

  const loginLine = (
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
  );

  return (
    <AuthShell onLogin={goLogin}>
      {step === "checking" && (
        <div role="status" className="flex items-center gap-2 text-sm text-white/80">
          <Spinner size="sm" /> Checking your registration link…
        </div>
      )}

      {step === "request" && (
        <form onSubmit={requestLink}>
          {header(
            "Register",
            "Enter your CCC email. We'll send a secure link to verify your library record and set your password.",
          )}
          <div className="mt-4">
            <Reveal direction="up" distance={28} delay={100} once>
              <Field label="CCC email">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={254}
                  value={emailInput}
                  onChange={(event) => setEmailInput(event.target.value)}
                  placeholder={`yourname${DOMAIN}`}
                  className={inputCls}
                />
              </Field>
            </Reveal>
          </div>
          {errorBox}
          <button
            type="submit"
            disabled={loading}
            className={`mt-3 ${glassButton}`}
          >
            {loading ? (
              <>
                <Spinner size="sm" /> Sending link…
              </>
            ) : (
              "Send registration link"
            )}
          </button>
          {loginLine}
        </form>
      )}

      {step === "sent" && (
        <div role="status">
          {header(
            "Check your email",
            "Open the registration link we sent to your CCC email. It verifies your library record and lets you set a password.",
          )}
          <div className="mt-3 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs text-white/75">
            Sent to <b className="text-white">{verifiedEmail}</b>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-white/50">
            The link expires in 30 minutes and can be used once. Check your spam
            folder if you don't see it.
          </p>
          <button type="button" onClick={reset} className={`mt-3 ${glassButton}`}>
            Use a different email
          </button>
          {loginLine}
        </div>
      )}

      {step === "identity" && (
        <form onSubmit={verifyIdentity}>
          {header(
            "Verify your library record",
            "Enter the name and library ID printed on your library card. They must match the library record for this email.",
          )}
          <div className="mt-4 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[11px] text-white/65">
            Registration link for <b className="text-white">{verifiedEmail}</b>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <Reveal direction="up" distance={28} delay={80} once className="col-span-3">
              <Field label="Library ID">
                <input
                  type="text"
                  required
                  maxLength={64}
                  value={identity.library_id}
                  onChange={(event) =>
                    setIdentity((current) => ({ ...current, library_id: event.target.value }))
                  }
                  placeholder="2024-0001"
                  className={inputCls}
                />
              </Field>
            </Reveal>
            <Reveal direction="up" distance={28} delay={120} once className="col-span-3">
              <Field label="Surname">
                <input
                  type="text"
                  required
                  autoComplete="family-name"
                  maxLength={100}
                  value={identity.surname}
                  onChange={(event) =>
                    setIdentity((current) => ({ ...current, surname: event.target.value }))
                  }
                  placeholder="Dela Cruz"
                  className={inputCls}
                />
              </Field>
            </Reveal>
            <Reveal direction="up" distance={28} delay={160} once className="col-span-2">
              <Field label="First name">
                <input
                  type="text"
                  required
                  autoComplete="given-name"
                  maxLength={100}
                  value={identity.first_name}
                  onChange={(event) =>
                    setIdentity((current) => ({ ...current, first_name: event.target.value }))
                  }
                  placeholder="Juan"
                  className={inputCls}
                />
              </Field>
            </Reveal>
            <Reveal direction="up" distance={28} delay={160} once>
              <Field label="M.I.">
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={identity.middle_initial}
                  onChange={(event) =>
                    setIdentity((current) => ({
                      ...current,
                      middle_initial: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="S"
                  className={`${inputCls} text-center uppercase`}
                />
              </Field>
            </Reveal>
          </div>
          {errorBox}
          <button
            type="submit"
            disabled={loading}
            className={`mt-3 ${glassButton}`}
          >
            {loading ? (
              <>
                <Spinner size="sm" /> Checking…
              </>
            ) : (
              "Continue"
            )}
          </button>
          <button
            type="button"
            onClick={reset}
            className="mt-3 block text-[11px] text-white/70 underline underline-offset-2 hover:text-white"
          >
            Request a new link
          </button>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={createAccount}>
          {header(
            "Create your password",
            "Your library record is verified. Choose a password for this account.",
          )}
          <div className="mt-3 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[11px] text-white/65">
            Account email <b className="text-white">{verifiedEmail}</b>
          </div>
          <div className="mt-3 space-y-2.5">
            <Field label="Password">
              <input
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className={inputCls}
              />
            </Field>
            <Field label="Confirm password">
              <input
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Type it again"
                className={inputCls}
              />
            </Field>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] leading-snug">
            {checks.map((check) => (
              <li
                key={check.label}
                className={check.ok ? "text-emerald-300" : "text-white/45"}
              >
                {check.ok ? "✓" : "•"} {check.label}
              </li>
            ))}
          </ul>
          {errorBox}
          <button
            type="submit"
            disabled={loading || !passwordReady}
            className={`mt-3 ${glassButton}`}
          >
            {loading ? (
              <>
                <Spinner size="sm" /> Creating account…
              </>
            ) : (
              "Create account"
            )}
          </button>
          {loginLine}
        </form>
      )}

      {step === "done" && (
        <div role="status">
          {header(
            "Account created",
            "Your account is ready. Log in with your CCC email and the password you just chose.",
          )}
          <div className="mt-3 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs text-white/75">
            Email <b className="text-white">{verifiedEmail}</b>
          </div>
          <button type="button" onClick={goLogin} className={`mt-3 ${glassButton}`}>
            Go to login
          </button>
        </div>
      )}
    </AuthShell>
  );
}

export default Register;
