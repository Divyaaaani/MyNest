import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, register, forgotPassword, resetPassword } from "../api";
import Logo from "../components/Logo";

// --- Password helpers (mirror server/utils/password.js) ---
const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "12345678",
  "123456789",
  "qwerty123",
  "abc123456",
  "letmein",
  "welcome",
  "admin123",
  "1234567890",
]);

function getPasswordErrors(pw) {
  const errs = [];
  if (!pw) {
    errs.push("password is required");
    return errs;
  }
  if (pw.length < 8) errs.push("password must be at least 8 characters");
  if (pw.length > 128) errs.push("password must be at most 128 characters");
  if (/\s/.test(pw)) errs.push("password must not contain spaces");
  if (!/[A-Z]/.test(pw)) errs.push("password must contain at least one uppercase letter (A-Z)");
  if (!/[a-z]/.test(pw)) errs.push("password must contain at least one lowercase letter (a-z)");
  if (!/[0-9]/.test(pw)) errs.push("password must contain at least one number (0-9)");
  if (!/[^A-Za-z0-9]/.test(pw)) errs.push("password must contain at least one special character (e.g. !@#$%^&*)");
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) errs.push("password is too common — choose a more unique one");
  return errs;
}

function getPasswordCriteria(pw) {
  return [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "Uppercase letter (A-Z)", ok: /[A-Z]/.test(pw) },
    { label: "Lowercase letter (a-z)", ok: /[a-z]/.test(pw) },
    { label: "Number (0-9)", ok: /[0-9]/.test(pw) },
    { label: "Special character (!@#$…)", ok: /[^A-Za-z0-9]/.test(pw) },
    { label: "No spaces", ok: pw.length === 0 || !/\s/.test(pw) },
  ];
}

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: "", percent: 0, color: "" };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
  if (pw.length >= 12 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
  const colors = ["#e35d6a", "#e67e22", "#f2a65a", "#00a06d", "#006b48"];
  const percents = [15, 30, 55, 80, 100];
  return { score, label: labels[score], percent: percents[score], color: colors[score] };
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0112 19C5 19 1 12 1 12a21.3 21.3 0 014.06-5.04" />
      <path d="M9.53 9.53A3.5 3.5 0 0012 15.5a3.5 3.5 0 003.47-2.97" />
      <path d="M14.12 14.12L9.88 9.88" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

export default function Auth() {
  const [tab, setTab] = useState("login");
  const [role, setRole] = useState("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("form"); // form | forgot | reset
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [copied, setCopied] = useState(false);
  const [timer, setTimer] = useState(0); // seconds left for 15 min
  const [resendBusy, setResendBusy] = useState(false);

  function validateEmail(v) {
    const t = v.trim();
    if (!t) return "Email is required";
    if (t.length > 255) return "Email is too long";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Please enter a valid email address (e.g. you@college.edu)";
    return "";
  }

  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mynest_user") || "null");
    } catch {
      return null;
    }
  });

  // Derived password state for live UI
  const passwordErrors = useMemo(() => getPasswordErrors(password), [password]);
  const criteria = useMemo(() => getPasswordCriteria(password), [password]);
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const showSignupValidation = tab === "signup" && (passwordTouched || password.length > 0);
  const showResetValidation = view === "reset" && (passwordTouched || password.length > 0);
  const shouldShowCriteria = showSignupValidation || showResetValidation;

  function resetPasswordFields() {
    setPassword("");
    setConfirmPassword("");
    setPasswordTouched(false);
    setConfirmTouched(false);
    setShowPassword(false);
    setShowConfirm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const emErr = validateEmail(email);
    if (emErr) {
      setEmailError(emErr);
      setError(emErr);
      return;
    }
    setEmailError("");

    // Strong password check on signup (login stays lenient)
    if (tab === "signup") {
      const errs = getPasswordErrors(password);
      if (errs.length > 0) {
        setPasswordTouched(true);
        setError(errs[0]);
        return;
      }
      if (password !== confirmPassword) {
        setConfirmTouched(true);
        setError("Passwords do not match");
        return;
      }
    } else {
      if (!password) {
        setError("Password is required");
        return;
      }
    }

    setError("");
    setMessage("");
    setBusy(true);
    try {
      const data =
        tab === "login"
          ? await login(email, password)
          : await register(name, email, password, role, phone);
      localStorage.setItem("mynest_token", data.token);
      localStorage.setItem("mynest_user", JSON.stringify(data.user));
      setMessage("Welcome, " + data.user.name + "!");
      setTimeout(() => navigate(data.user.role === "owner" ? "/owner" : "/dashboard"), 800);
    } catch (err) {
      // Surface server Zod details nicely if present
      let msg = err.message || "Something went wrong";
      // If server returned validation details, show first password issue first
      if (msg.includes("Invalid input") && passwordErrors.length > 0 && tab === "signup") {
        msg = passwordErrors[0];
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("mynest_token");
    localStorage.removeItem("mynest_user");
    setCurrentUser(null);
    navigate("/");
  }

  function initials(name) {
    return (name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  async function handleForgot(e) {
    e.preventDefault();
    const emErr = validateEmail(email);
    if (emErr) {
      setEmailError(emErr);
      setError(emErr);
      return;
    }
    setEmailError("");
    setError("");
    setMessage("");
    setBusy(true);
    // Show wake-up hint if Render free instance is sleeping (50s delay)
    const wakeTimer = setTimeout(() => setMessage("Waking up server (free instance) — this can take 30-50s on first try, please wait..."), 2500);
    try {
      const res = await forgotPassword(email);
      // dev_otp visible only locally when SMTP not configured
      if (res && res.dev_otp) {
        setDevOtp(res.dev_otp);
        setOtp(res.dev_otp); // auto-fill for local dev convenience
        setTimer(15 * 60);
        setMessage(`Code sent — check your email (valid 15 minutes).`);
      } else if (res && res.dev_note && res.dev_note.includes("No account")) {
        setDevOtp("");
        setError(res.dev_note + " — please sign up first.");
        return;
      } else {
        setDevOtp("");
        setTimer(15 * 60);
        setMessage("Code sent — check your email (valid 15 minutes).");
      }
      setView("reset");
      setPassword("");
      setConfirmPassword("");
      setPasswordTouched(false);
      setConfirmTouched(false);
    } catch (err) {
      clearTimeout(wakeTimer);
      // Render free instance often returns 502/timeout on wake — retry once
      if (err.message && err.message.includes("Failed to fetch")) {
        setError("Server waking up (free tier) — please tap Send code again in 10s");
      } else {
        setError(err.message);
      }
    } finally {
      clearTimeout(wakeTimer);
      setBusy(false);
    }
  }

  async function handleResend() {
    if (!email || resendBusy) return;
    setResendBusy(true);
    setError("");
    try {
      const res = await forgotPassword(email);
      if (res && res.dev_otp) {
        setDevOtp(res.dev_otp);
        setOtp(res.dev_otp);
        setTimer(15 * 60);
        setMessage("New code sent — valid 15 minutes.");
      } else {
        setTimer(15 * 60);
        setMessage("Code re-sent — check your email.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setResendBusy(false);
    }
  }

  // 15-min countdown for verification page
  useEffect(() => {
    if (view !== "reset" || timer <= 0) return;
    const id = setInterval(() => setTimer(t => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [view, timer]);

  function formatTimer(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  async function handleReset(e) {
    e.preventDefault();
    const emErr = validateEmail(email);
    if (emErr) {
      setEmailError(emErr);
      setError(emErr);
      return;
    }
    setEmailError("");
    const errs = getPasswordErrors(password);
    if (errs.length > 0) {
      setPasswordTouched(true);
      setError(errs[0]);
      return;
    }
    if (password !== confirmPassword) {
      setConfirmTouched(true);
      setError("Passwords do not match");
      return;
    }
    if (!otp || otp.length !== 6) {
      setError("Enter the 6-digit code from your email");
      return;
    }
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await resetPassword(email, otp, password);
      setView("form");
      setTab("login");
      setOtp("");
      resetPasswordFields();
      setMessage("Password updated — log in with your new password.");
    } catch (err) {
      let msg = err.message || "Reset failed";
      if (msg.includes("Invalid input") && getPasswordErrors(password).length > 0) {
        msg = getPasswordErrors(password)[0];
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container my-5">
      <div className="fn-auth-logo">
        <Logo />
      </div>
      <h1 className="fn-title text-center mb-1">
        {currentUser
          ? "Your account"
          : view === "forgot"
            ? "Reset password"
            : view === "reset"
              ? "Enter your code"
              : tab === "login"
                ? "Welcome back"
                : "Join myNest"}
      </h1>
      <p className="fn-section-sub text-center mb-4">
        {currentUser
          ? `You're logged in as ${currentUser.name}.`
          : view === "forgot"
            ? "We'll email you a 6-digit code."
            : view === "reset"
              ? `Code sent to ${email || "your email"} — valid 15 minutes.`
              : tab === "login"
                ? "Log in to track rent, groups and roommates."
                : "One account for PGs, roommates and rent tracking."}
      </p>

      {currentUser ? (
        <div className="card p-4 fn-auth-card text-center">
          <div className="fn-avatar fn-avatar-lg mx-auto mb-3">
            {initials(currentUser.name)}
          </div>
          <h2 className="fn-title mb-2">{currentUser.name}</h2>
          <div className="mb-3">
            <span className="fn-result-chip">
              {currentUser.role === "owner" ? "PG Owner" : "Student"}
            </span>
          </div>
          <div className="fn-account-row">
            <span>Email</span>
            <strong>{currentUser.email}</strong>
          </div>
          {currentUser.phone && (
            <div className="fn-account-row">
              <span>Phone</span>
              <strong>{currentUser.phone}</strong>
            </div>
          )}
          <div className="d-grid gap-2 mt-4">
            <Link
              className="btn btn-primary"
              to={currentUser.role === "owner" ? "/owner" : "/dashboard"}
            >
              Go to {currentUser.role === "owner" ? "owner dashboard" : "dashboard"}
            </Link>
            <button className="btn btn-outline-danger" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      ) : view !== "form" ? (
        <div className="card p-4 fn-auth-card">
          {view === "forgot" ? (
            <>
              <h2 className="fn-section-title mb-1">Forgot password?</h2>
              <p className="fn-section-sub mb-3">Enter your account email.</p>
              <form onSubmit={handleForgot}>
                <div className="mb-3">
                  <label className="fn-label" htmlFor="auth-fg-email">Email</label>
                  <input
                    id="auth-fg-email"
                    className={`form-control ${emailError ? "is-invalid" : ""}`}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(validateEmail(e.target.value)); }}
                    onBlur={() => setEmailError(validateEmail(email))}
                    placeholder="you@college.edu"
                    aria-invalid={!!emailError}
                  />
                  {emailError && <div className="fn-field-error">{emailError}</div>}
                </div>
                <button type="submit" className="btn btn-primary w-100 fn-btn-shine" disabled={busy}>
                  {busy ? "Sending…" : "Send code"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="fn-verify-head">
                <div className="fn-verify-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
                </div>
                <h2 className="fn-section-title mb-1">Check your email</h2>
                <p className="fn-section-sub mb-2">We sent a 6-digit code to</p>
                <div className="fn-verify-email-pill">{email || "your email"}</div>
                {timer > 0 && <div className="fn-verify-timer">{timer > 0 ? `Expires in ${formatTimer(timer)}` : "Code expired — resend"}</div>}
              </div>

              {devOtp && (
                <div className="fn-dev-otp">
                  <div className="fn-dev-otp-label">Local dev — no SMTP configured</div>
                  <div className="fn-dev-otp-row">
                    <code className="fn-dev-otp-code">{devOtp}</code>
                    <button type="button" className="btn btn-sm btn-outline-primary fn-copy-btn" onClick={async () => { try { await navigator.clipboard.writeText(devOtp); setCopied(true); setTimeout(()=>setCopied(false), 1500); } catch {} }}>
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => setOtp(devOtp)}>Fill</button>
                  </div>
                  <small className="fn-dev-otp-hint">This banner only shows on localhost. In production the code goes to your inbox.</small>
                </div>
              )}

              <form onSubmit={handleReset}>
                <div className="mb-3">
                  <label className="fn-label" htmlFor="auth-otp">6-digit code</label>
                  <input
                    id="auth-otp"
                    className="form-control fn-otp-input"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="• • • • • •"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                  <div className="fn-verify-actions">
                    <span className="fn-hint">Paste the code — auto-fills</span>
                    <button type="button" className="btn btn-link btn-sm p-0 fn-resend-link" onClick={handleResend} disabled={resendBusy}>
                      {resendBusy ? "Sending…" : "Resend code"}
                    </button>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="fn-label" htmlFor="auth-new-password">New password</label>
                  <div className="fn-pw-wrap">
                    <input
                      id="auth-new-password"
                      className={`form-control fn-pw-input ${passwordTouched && passwordErrors.length > 0 ? "is-invalid" : passwordTouched && passwordErrors.length === 0 && password.length > 0 ? "is-valid" : ""}`}
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (!passwordTouched) setPasswordTouched(true); }}
                      onBlur={() => setPasswordTouched(true)}
                      placeholder="Min 8 chars, upper, lower, number, symbol"
                      autoComplete="new-password"
                      aria-describedby="pw-criteria-reset pw-strength-reset"
                    />
                    <button type="button" className="fn-pw-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"} tabIndex={0}>
                      <EyeIcon open={!showPassword} />
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div id="pw-strength-reset" className="fn-pw-strength">
                      <div className="fn-pw-strength-bar">
                        <div className="fn-pw-strength-fill" style={{ width: `${strength.percent}%`, background: strength.color }} />
                      </div>
                      <span className="fn-pw-strength-label" style={{ color: strength.color }}>{strength.label}</span>
                    </div>
                  )}
                  {(passwordTouched || password.length > 0) && (
                    <ul id="pw-criteria-reset" className="fn-pw-criteria">
                      {criteria.map(c => (
                        <li key={c.label} className={c.ok ? "ok" : "fail"}>
                          <span className="fn-pw-check" aria-hidden="true">{c.ok ? "✓" : "·"}</span> {c.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  {passwordTouched && passwordErrors.length > 0 && <div className="fn-field-error">{passwordErrors[0]}</div>}
                </div>
                <div className="mb-3">
                  <label className="fn-label" htmlFor="auth-confirm-reset">Confirm new password</label>
                  <div className="fn-pw-wrap">
                    <input
                      id="auth-confirm-reset"
                      className={`form-control fn-pw-input ${confirmTouched && confirmMismatch ? "is-invalid" : confirmTouched && confirmPassword.length > 0 && !confirmMismatch && password.length > 0 ? "is-valid" : ""}`}
                      type={showConfirm ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); if (!confirmTouched) setConfirmTouched(true); }}
                      onBlur={() => setConfirmTouched(true)}
                      placeholder="Re-enter your new password"
                      autoComplete="new-password"
                    />
                    <button type="button" className="fn-pw-toggle" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Hide password" : "Show password"}>
                      <EyeIcon open={!showConfirm} />
                    </button>
                  </div>
                  {confirmTouched && confirmMismatch && <div className="fn-field-error">Passwords do not match</div>}
                  {confirmTouched && !confirmMismatch && confirmPassword.length > 0 && <div className="fn-field-success">Passwords match</div>}
                </div>
                <button type="submit" className="btn btn-primary w-100 fn-btn-shine" disabled={busy}>
                  {busy ? "Updating…" : "Set new password"}
                </button>
              </form>
            </>
          )}
          <button
            type="button"
            className="btn btn-link w-100 mt-2"
            onClick={() => { setView("form"); setError(""); setMessage(""); setEmailError(""); resetPasswordFields(); }}
          >
            Back to login
          </button>
        </div>
      ) : (
      <div className="card p-4 fn-auth-card">
        <ul className="nav nav-pills nav-fill mb-4">
          <li className="nav-item">
            <button
              className={`nav-link w-100 ${tab === "login" ? "active fn-tab" : "text-secondary"}`}
              onClick={() => { setTab("login"); setError(""); setMessage(""); setEmailError(""); setPasswordTouched(false); setConfirmTouched(false); }}
            >
              Login
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link w-100 ${tab === "signup" ? "active fn-tab" : "text-secondary"}`}
              onClick={() => { setTab("signup"); setError(""); setMessage(""); setEmailError(""); }}
            >
              Sign up
            </button>
          </li>
        </ul>

        {tab === "signup" && (
        <div className="d-flex gap-2 mb-3">
          <button
            type="button"
            className={`flex-fill fn-role-btn ${role === "student" ? "active" : ""}`}
            onClick={() => setRole("student")}
          >
            <strong>Student / Tenant</strong>
            <small className="d-block text-muted">Find a PG, pay rent, find roommates</small>
          </button>
          <button
            type="button"
            className={`flex-fill fn-role-btn ${role === "owner" ? "active" : ""}`}
            onClick={() => setRole("owner")}
          >
            <strong>PG Owner</strong>
            <small className="d-block text-muted">List PGs, manage tenants & rent</small>
          </button>
        </div>
        )}

        <form onSubmit={handleSubmit}>
          {tab === "signup" && (
            <>
              <div className="mb-3">
                <label className="fn-label" htmlFor="auth-name">Full name</label>
                <input
                  id="auth-name"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="fn-label" htmlFor="auth-phone">Phone number <span className="fn-optional">(optional)</span></label>
                <input
                  id="auth-phone"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 98765 43210"
                  type="tel"
                />
              </div>
            </>
          )}
          <div className="mb-3">
            <label className="fn-label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className={`form-control ${emailError ? "is-invalid" : ""}`}
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(validateEmail(e.target.value)); }}
              onBlur={() => setEmailError(validateEmail(email))}
              placeholder="you@college.edu"
              type="email"
              required
              aria-invalid={!!emailError}
            />
            {emailError && <div className="fn-field-error">{emailError}</div>}
          </div>
          <div className="mb-3">
            <label className="fn-label" htmlFor="auth-password">Password</label>
            <div className="fn-pw-wrap">
              <input
                id="auth-password"
                className={`form-control fn-pw-input ${tab === "signup" && passwordTouched && passwordErrors.length > 0 ? "is-invalid" : tab === "signup" && passwordTouched && passwordErrors.length === 0 && password.length > 0 ? "is-valid" : ""}`}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (tab === "signup" && !passwordTouched) setPasswordTouched(true); }}
                onBlur={() => { if (tab === "signup") setPasswordTouched(true); }}
                placeholder={tab === "signup" ? "Min 8 chars, upper, lower, number, symbol" : "Your password"}
                type={showPassword ? "text" : "password"}
                required
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                aria-describedby={tab === "signup" ? "pw-criteria pw-strength" : undefined}
              />
              <button type="button" className="fn-pw-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <EyeIcon open={!showPassword} />
              </button>
            </div>
            {tab === "signup" ? (
              <>
                {password.length > 0 && (
                  <div id="pw-strength" className="fn-pw-strength">
                    <div className="fn-pw-strength-bar">
                      <div className="fn-pw-strength-fill" style={{ width: `${strength.percent}%`, background: strength.color }} />
                    </div>
                    <span className="fn-pw-strength-label" style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                )}
                {shouldShowCriteria && (
                  <ul id="pw-criteria" className="fn-pw-criteria">
                    {criteria.map(c => (
                      <li key={c.label} className={c.ok ? "ok" : "fail"}>
                        <span className="fn-pw-check" aria-hidden="true">{c.ok ? "✓" : "·"}</span> {c.label}
                      </li>
                    ))}
                  </ul>
                )}
                {passwordTouched && passwordErrors.length > 0 && <div className="fn-field-error">{passwordErrors[0]}</div>}
                {!passwordTouched && <div className="fn-hint">Must include uppercase, lowercase, number & special character.</div>}
              </>
            ) : null}
          </div>
          {tab === "signup" && (
            <div className="mb-3">
              <label className="fn-label" htmlFor="auth-confirm">Confirm password</label>
              <div className="fn-pw-wrap">
                <input
                  id="auth-confirm"
                  className={`form-control fn-pw-input ${confirmTouched && confirmMismatch ? "is-invalid" : confirmTouched && confirmPassword.length > 0 && !confirmMismatch && password.length > 0 ? "is-valid" : ""}`}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); if (!confirmTouched) setConfirmTouched(true); }}
                  onBlur={() => setConfirmTouched(true)}
                  placeholder="Re-enter your password"
                  type={showConfirm ? "text" : "password"}
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="fn-pw-toggle" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Hide password" : "Show password"}>
                  <EyeIcon open={!showConfirm} />
                </button>
              </div>
              {confirmTouched && confirmMismatch && <div className="fn-field-error">Passwords do not match</div>}
              {confirmTouched && !confirmMismatch && confirmPassword.length > 0 && password.length > 0 && <div className="fn-field-success">Passwords match</div>}
            </div>
          )}
          <button type="submit" className="btn btn-primary w-100 fn-btn-shine" disabled={busy}>
            {busy
              ? tab === "login" ? "Logging in…" : "Creating account…"
              : tab === "login" ? "Log in" : `Create ${role === "owner" ? "owner" : "student"} account`}
          </button>
          {tab === "login" && (
            <button
              type="button"
              className="btn btn-link w-100 mt-2 p-0"
              onClick={() => { setView("forgot"); setError(""); setMessage(""); setEmailError(""); resetPasswordFields(); }}
            >
              Forgot password?
            </button>
          )}
        </form>
      </div>
      )}

      {message && <div className="fn-alert fn-alert-success" role="status">{message}</div>}
      {error && <div className="fn-alert fn-alert-error" role="alert">{error}</div>}
    </div>
  );
}
