// Login page — ECDAT design system.
import { useEffect, useId, useState, type FormEvent } from "react";
import { ApiError, login } from "../api/client";
import { motion, useReducedMotion } from "framer-motion";
import { workspaceEase } from "../components/WorkspaceMotion";

export default function Login({
  onSuccess,
  message = "",
}: {
  onSuccess: () => void;
  message?: string;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(message);
  const [busy, setBusy] = useState(false);
  const reduced = useReducedMotion();
  const reveal = {
    hidden: { opacity: 0, y: reduced ? 0 : 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0 : 0.45, ease: workspaceEase },
    },
  };
  const sequence = {
    hidden: {},
    visible: { transition: { staggerChildren: reduced ? 0 : 0.08 } },
  };

  useEffect(() => setError(message), [message]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Invalid username or password."
          : err instanceof ApiError && err.status === 429
            ? "Too many sign-in attempts. Please try again later."
            : "Unable to sign in. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main className="login-shell" id="main-content" tabIndex={-1}>
        <motion.aside
          className="login-context"
          aria-label="About ImpactX"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.3, ease: workspaceEase }}
        >
          <div className="login-identity">
            <img className="brand-mark" src="/ecdat-logo.svg" alt="" aria-hidden="true" />
            <div>
              <div className="login-identity-name">ImpactX</div>
              <div className="login-identity-subtitle">Discovery Assurance</div>
            </div>
          </div>
          <div className="login-panel-body">
            <p className="eyebrow">Cryptographic intelligence</p>
            <p className="login-context-title">
              Discover. Defend.
              <br />
              <em>Become quantum ready.</em>
            </p>
            <p>
              Discover cryptography. Trace the evidence. Prioritize your path to quantum readiness.
            </p>
            <motion.img
              className="login-signal"
              initial={reduced ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: reduced ? 0 : 0.6, ease: workspaceEase }}
              src="/crypto-shield.svg"
              alt="Source, dependencies and certificates connected to a cryptographic shield"
            />
          </div>
        </motion.aside>
        <motion.section
          className="login-panel--form"
          aria-labelledby="login-heading"
          initial={reduced ? false : { opacity: 1, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.3, ease: workspaceEase }}
        >
          <motion.div
            className="login-card"
            variants={sequence}
            initial={reduced ? false : "hidden"}
            animate="visible"
          >
            <motion.h1 variants={reveal} id="login-heading" className="login-card-title">
              Sign in
            </motion.h1>
            <motion.p variants={reveal} className="login-card-desc">
              Access your cryptographic inventory and risk workspace.
            </motion.p>

            {error && (
              <motion.div
                initial={reduced ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduced ? 0 : 0.2 }}
                className="login-error"
                id="login-error"
                role="alert"
              >
                {error}
              </motion.div>
            )}

            <motion.form
              variants={reveal}
              onSubmit={submit}
              aria-busy={busy}
              className="login-form"
            >
              <LoginField
                label="Username"
                value={username}
                onChange={setUsername}
                autoComplete="username"
                invalid={Boolean(error)}
                describedBy={error ? "login-error" : undefined}
              />

              <LoginField
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete="current-password"
                invalid={Boolean(error)}
                describedBy={error ? "login-error" : undefined}
              />

              <motion.button
                whileHover={reduced || busy || !username || !password ? undefined : { y: -2 }}
                whileTap={reduced || busy || !username || !password ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.15 }}
                type="submit"
                className="button wide login-submit"
                disabled={busy || !username || !password}
              >
                {busy && <span className="spinner login-spinner" aria-hidden="true" />}
                {busy ? "Signing in…" : "Sign in"}
              </motion.button>
            </motion.form>

            <motion.div variants={reveal} className="login-hint" role="note">
              <strong>Administrator-provisioned access</strong>
              <span>Use your configured account. There are no default passwords.</span>
            </motion.div>
          </motion.div>
        </motion.section>
      </main>
    </>
  );
}

function LoginField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  invalid = false,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const inputId = useId();

  return (
    <div className="float-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        name={label.toLowerCase()}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        required
        placeholder=" "
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
