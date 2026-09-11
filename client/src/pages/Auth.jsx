import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, register } from "../api";
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

  return (
    <div className="container my-5">
      <div className="fn-auth-logo">
        <Logo />
      </div>
      <h1 className="fn-title text-center mb-1">
        {currentUser ? "Your account" : tab === "login" ? "Welcome back" : "Join myNest"}
      </h1>
      <p className="fn-section-sub text-center mb-4">
        {currentUser
          ? `You're logged in as ${currentUser.name}.`
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
        </form>
      </div>
      )}

      {message && <div className="fn-alert fn-alert-success" role="status">{message}</div>}
      {error && <div className="fn-alert fn-alert-error" role="alert">{error}</div>}
    </div>
  );
}
