import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => {
    const notice = sessionStorage.getItem("notice") || "";
    sessionStorage.removeItem("notice");
    return notice;
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Say what to fix, and keep what the user already typed
    if (!email.trim() || !password) {
      setError("Enter your email address and your password.");
      return;
    }

    setLoading(true);
    try {
      // TODO: confirm this route and the response shape with the back-end (routes/auth.js)
      const res = await api.post("/api/auth/login", {
        email: email.trim(),
        password,
      });
      const token = res.data.token;
      const role = res.data.role || res.data.user?.role;

      if (!token || !role) {
        setError("Login worked but the reply had no token or role. Check the back-end response.");
        return;
      }

      localStorage.setItem("token", token);
      localStorage.setItem("role", role);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate(role === "lecturer" ? "/lecturer/slots" : "/book", { replace: true });
        } catch (err) {
      if (!err.response) {
        setError("We could not reach the server. Check your connection and try again.");
      } else if (err.response.status >= 500) {
        setError("Something went wrong on our side. Please try again in a moment.");
      } else if (err.response.status === 400) {
        
        setError(err.response.data?.error || "Check your email address and password.");
      } else {
        
        setError("Wrong email or password, please try again");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <section className="login-intro">
        <svg className="login-tiles" viewBox="0 0 184 368" aria-hidden="true">
          <defs>
            <pattern id="login-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="9" height="9" fill="#0e3d55" />
              <line x1="0" y1="0" x2="0" y2="9" stroke="#bfe9f4" strokeWidth="2.2" />
            </pattern>
          </defs>
          <rect width="92" height="92" fill="#124a66" />
          <circle cx="46" cy="46" r="36" fill="#072c3f" />
          <circle cx="46" cy="46" r="19" fill="#5ac9e5" />
          <circle cx="46" cy="46" r="7" fill="#072c3f" />
          <path d="M92 0 H184 A92 92 0 0 1 92 92 Z" fill="#5ac9e5" />
          <rect y="92" width="92" height="92" fill="url(#login-hatch)" />
          <path d="M92 184 V92 A92 92 0 0 1 184 184 Z" fill="#1c8fc9" />
          <g fill="#bfe9f4" opacity=".8">
            {[206, 230, 254].flatMap((y) => [114, 138, 162].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5" />))}
          </g>
          <path d="M0 368 V276 A92 92 0 0 1 92 368 Z" fill="#8bc34a" />
          <rect x="102" y="308" width="76" height="28" rx="14" fill="#b06ac4" />
        </svg>
        <svg className="login-tiles-corner" viewBox="0 0 138 138" aria-hidden="true">
          <rect y="46" width="92" height="92" fill="url(#login-hatch)" />
          <path d="M92 138 V92 A46 46 0 0 1 138 138 Z" fill="#5ac9e5" />
        </svg>
        <img className="login-ribbon" src="/img/ribbon.webp" alt="" />
        <div className="login-brand">CampusBook</div>
        <h1>
          <span className="cb-hero-light">Book </span>
          <span className="cb-hero-white">lecturer consultations </span>
          <span className="cb-hero-strong">in one place</span>
        </h1>
        <p className="login-kicker">With CampusBook</p>
        <p className="login-lead">
          See open times, book in a few clicks and get an email reminder.
        </p>
        <div className="login-figure">
          <img src="/img/hero-woman.webp" alt="" />
        </div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <h2>Log in</h2>
          <p className="cb-muted login-hint">Use your CTU email address</p>

          <div className="cb-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
            />
          </div>

          <div className="cb-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="cb-alert cb-alert-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="cb-btn cb-btn-primary cb-btn-block"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <a href="#" className="login-forgot" onClick={(e) => e.preventDefault()}>
            Forgot password
          </a>
        </form>
      </section>
    </main>
  );
}
