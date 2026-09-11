import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, register, forgotPassword, resetPassword } from "../api";
import Logo from "../components/Logo";

export default function Auth() {
  const [tab, setTab] = useState("login");
  const [role, setRole] = useState("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("form"); // form | forgot | reset
  const [otp, setOtp] = useState("");
  const navigate = useNavigate();
  // Who's logged in right now (null = logged out -> show the form).
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mynest_user") || "null");
    } catch {
      return null;
    }
  });

  async function handleSubmit(e) {
    e.preventDefault();
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
      setError(err.message);
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
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await forgotPassword(email);
      setView("reset");
      setMessage("Code sent — check your email (valid 15 minutes).");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await resetPassword(email, otp, password);
      setView("form");
      setTab("login");
      setOtp("");
      setPassword("");
      setMessage("Password updated — log in with your new password.");
    } catch (err) {
      setError(err.message);
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
                    className="form-control"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@college.edu"
                  />
                </div>
                <button type="submit" className="btn btn-primary w-100 fn-btn-shine" disabled={busy}>
                  {busy ? "Sending…" : "Send code"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="fn-section-title mb-1">Check your email</h2>
              <p className="fn-section-sub mb-3">Enter the 6-digit code + a new password.</p>
              <form onSubmit={handleReset}>
                <div className="mb-3">
                  <label className="fn-label" htmlFor="auth-otp">6-digit code</label>
                  <input
                    id="auth-otp"
                    className="form-control"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </div>
                <div className="mb-3">
                  <label className="fn-label" htmlFor="auth-new-password">New password</label>
                  <input
                    id="auth-new-password"
                    className="form-control"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
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
            onClick={() => { setView("form"); setError(""); setMessage(""); }}
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
              onClick={() => { setTab("login"); setError(""); setMessage(""); }}
            >
              Login
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link w-100 ${tab === "signup" ? "active fn-tab" : "text-secondary"}`}
              onClick={() => { setTab("signup"); setError(""); setMessage(""); }}
            >
              Sign up
            </button>
          </li>
        </ul>

        {/* Role picker: students rent PGs, owners run PGs (signup only) */}
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
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@college.edu"
              type="email"
              required
            />
          </div>
          <div className="mb-3">
            <label className="fn-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === "signup" ? "At least 8 characters" : "Your password"}
              type="password"
              required
              minLength={tab === "signup" ? 8 : undefined}
            />
            {tab === "signup" && (
              <div className="fn-hint">At least 8 characters — anything you like.</div>
            )}
          </div>
          <button type="submit" className="btn btn-primary w-100 fn-btn-shine" disabled={busy}>
            {busy
              ? tab === "login" ? "Logging in…" : "Creating account…"
              : tab === "login" ? "Log in" : `Create ${role === "owner" ? "owner" : "student"} account`}
          </button>
          {tab === "login" && (
            <button
              type="button"
              className="btn btn-link w-100 mt-2 p-0"
              onClick={() => { setView("forgot"); setError(""); setMessage(""); }}
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
