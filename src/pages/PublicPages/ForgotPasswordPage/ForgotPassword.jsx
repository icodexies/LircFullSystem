// Public page: /forgot-password
// The visitor types their account email. The request-password-reset
// function emails a one-time link. The success message is intentionally
// generic ("if that email has an account...") so nobody can use this page
// to discover which emails have accounts.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogin } from "../../../hooks/auth/useLogin.js";
import { requestPasswordReset } from "../../../services/auth/authService.js";
import Reveal from "../../../components/ui/Reveal.jsx";
import AuthShell, {
  Field,
  inputCls,
  glassButton,
} from "../../../components/auth/AuthShell.jsx";
import { Spinner } from "../../../components/ui/Loading.jsx";

const DOMAIN = "@ccc.edu.ph";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { openLogin } = useLogin();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const goLogin = () => {
    navigate("/");
    openLogin?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setDone(true);
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
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
              If <b className="text-white">{email.trim().toLowerCase()}</b> has
              an LIRC account, we sent a link to choose a new password.
            </p>
            <p className="mt-2 text-xs text-white/50">
              Can't find it? Check your spam folder. The link can be used once
              and expires after a short time.
            </p>
          </Reveal>
          <Reveal direction="up" distance={32} delay={200} once>
            <button type="button" onClick={goLogin} className={`mt-5 ${glassButton}`}>
              Back to login
            </button>
          </Reveal>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Reveal direction="up" distance={32} delay={150} once>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white">
              Forgot your password?
            </h1>
            <p className="mt-1.5 text-[11px] leading-snug text-white/60">
              Enter your school email. We'll send you a link that opens a page
              where you can choose a new password.
            </p>
          </Reveal>

          <Reveal direction="up" distance={32} delay={250} once className="mt-4">
            <Field label="School email">
              <input
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`yourname${DOMAIN}`}
                className={inputCls}
              />
            </Field>
          </Reveal>

          {error && (
            <div role="alert" className="mt-2">
              <p className="text-[11px] font-medium text-red-300">{error}</p>
            </div>
          )}

          <Reveal direction="up" distance={32} delay={350} once>
            <button type="submit" disabled={loading} className={`mt-3 ${glassButton}`}>
              {loading ? (
                <>
                  <Spinner size="sm" /> Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </button>

            <p className="mt-3 text-[11px] text-white/80">
              Remembered it?{" "}
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
