import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api";

export default function Auth() {
  const [tab, setTab] = useState("login");
  const [role, setRole] = useState("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const data =
        tab === "login"
          ? await login(email, password)
          : await register(name, email, password, role, phone);
      localStorage.setItem("fairnest_token", data.token);
      localStorage.setItem("fairnest_user", JSON.stringify(data.user));
      setMessage("Welcome, " + data.user.name + "!");
      setTimeout(() => navigate(data.user.role === "owner" ? "/owner" : "/dashboard"), 800);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container my-5">
      <h1 className="fn-title text-center mb-4">Account</h1>

      <div className="card p-4 fn-auth-card">
        <ul className="nav nav-pills nav-fill mb-4">
          <li className="nav-item">
            <button
              className={`nav-link w-100 ${tab === "login" ? "active fn-tab" : "text-secondary"}`}
              onClick={() => setTab("login")}
            >
              Login
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link w-100 ${tab === "signup" ? "active fn-tab" : "text-secondary"}`}
              onClick={() => setTab("signup")}
            >
              Sign up
            </button>
          </li>
        </ul>

        {/* Role picker: students rent PGs, owners run PGs */}
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

        <form onSubmit={handleSubmit}>
          {tab === "signup" && (
            <>
              <div className="mb-3">
                <input
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  required
                />
              </div>
              <div className="mb-3">
                <input
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  type="tel"
                />
              </div>
            </>
          )}
          <div className="mb-3">
            <input
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              required
            />
          </div>
          <div className="mb-3">
            <input
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-100">
            {tab === "login" ? "Log in" : `Create ${role === "owner" ? "owner" : "student"} account`}
          </button>
        </form>
      </div>

      {message && <p className="text-success text-center mt-3">{message}</p>}
      {error && <p className="text-danger text-center mt-3">{error}</p>}
    </div>
  );
}
