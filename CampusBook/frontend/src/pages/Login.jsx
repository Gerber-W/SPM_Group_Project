import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
        <div className="login-brand">CampusBook</div>
        <h1>Book lecturer consultations in one place</h1>
        <p className="cb-muted">
          See open times, book in a few clicks and get an email reminder.
        </p>
        <div className="login-image" aria-hidden="true">
          Image of students and a lecturer
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
              placeholder="willem.gerber@campusbook.test"
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