// Public page: /reset-password
// Opens from the emailed link: /reset-password?token_hash=...&type=recovery
//
// The token proves the visitor controls the email address. completePasswordReset
// signs them in with the one-time token (verifyOtp), saves the new password
// (updateUser), and this page hides the token from the address bar.
// The one-time token cannot be reused, so opening the link twice fails politely.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogin } from "../../../hooks/auth/useLogin.js";
import { completePasswordReset } from "../../../services/auth/authService.js";
import {
  newPasswordError,
  MIN_PASSWORD_LENGTH,
} from "../../../services/auth/passwordRules.js";
import Reveal from "../../../components/ui/Reveal.jsx";
import AuthShell, {
  Field,
  inputCls,
  glassButton,
} from "../../../components/auth/AuthShell.jsx";
import { Spinner } from "../../../components/ui/Loading.jsx";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { openLogin } = useLogin();
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const tokenHash = params.get("token_hash");
  const ready = Boolean(tokenHash) && params.get("type") === "recovery";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);

  const goLogin = () => {
    navigate("/");
    openLogin?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    const ruleError = newPasswordError(password, confirm);
    if (ruleError) {
      setError(ruleError);
      return;
    }
    setLoading(true);
    try {
      await completePasswordReset(tokenHash, password);
      setDone(true);
      // Remove the one-time token from the address bar and history.
      window.history.replaceState({}, "", "/reset-password");
    } catch (err) {
      if (err?.code === "expired_link") setExpired(true);
      else setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!ready || expired) {
    return (
      <AuthShell onLogin={goLogin}>
        <Reveal direction="up" distance={32} once>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            Link not valid
          </h1>
          <p className="mt-3 text-sm text-white/70">
            {expired
              ? "This reset link has already been used or has expired. For safety, each link works only once."
              : "This page opens from the link we email you. This address is missing its reset token."}
          </p>
        </Reveal>
        <Reveal direction="up" distance={32} delay={150} once>
          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            className={`mt-5 ${glassButton}`}
          >
            Request a new link
          </button>
          <p className="mt-3 text-[11px] text-white/80">
            <button
              type="button"
              onClick={goLogin}
              className="underline underline-offset-2 hover:text-white"
            >
              Back to login
            </button>
          </p>
        </Reveal>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell onLogin={goLogin}>
        <div role="status">
          <Reveal direction="up" distance={32} once>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white">
              Password updated
            </h1>
          </Reveal>
          <Reveal direction="up" distance={32} delay={100} once>
            <p className="mt-3 text-sm text-white/70">
              Your new password is saved and you are now signed in. Use the
              button below — next time, log in with your new password.
            </p>
          </Reveal>
          <Reveal direction="up" distance={32} delay={200} once>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className={`mt-5 ${glassButton}`}
            >
              Go to my dashboard
            </button>
          </Reveal>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell onLogin={goLogin}>
      <form onSubmit={handleSubmit}>
        <Reveal direction="up" distance={32} delay={150} once>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            Choose a new password
          </h1>
          <p className="mt-1.5 text-[11px] leading-snug text-white/60">
            Your reset link worked. Pick a new password for your account.
          </p>
        </Reveal>

        <Reveal direction="up" distance={32} delay={250} once className="mt-4">
          <Field label="New password">
            <input
              type="password"
              required
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </Field>
        </Reveal>

        <Reveal direction="up" distance={32} delay={320} once className="mt-2.5">
          <Field label="Confirm new password">
            <input
              type="password"
              required
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={72}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </Field>
        </Reveal>

        <p className="mt-2 text-[10px] text-white/50">
          At least {MIN_PASSWORD_LENGTH} characters. LIRC staff will never ask
          you for your password.
        </p>

        {error && (
          <div role="alert" className="mt-2">
            <p className="text-[11px] font-medium text-red-300">{error}</p>
          </div>
        )}

        <Reveal direction="up" distance={32} delay={420} once>
          <button type="submit" disabled={loading} className={`mt-3 ${glassButton}`}>
            {loading ? (
              <>
                <Spinner size="sm" /> Saving…
              </>
            ) : (
              "Save new password"
            )}
          </button>
        </Reveal>
      </form>
    </AuthShell>
  );
}
