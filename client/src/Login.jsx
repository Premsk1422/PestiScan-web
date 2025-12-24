import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          "Server did not return JSON. Check backend /api/auth/login route."
        );
      }

      if (!res.ok) throw new Error(data.error || "Login failed");

      login(data.token);
      setSuccess("Logged in successfully.");
      setTimeout(() => navigate("/scan"), 250);
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ps-page">
      {/* Header outside card (matches Scan/History) */}
      <div className="mb-5 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-emerald-950">
          Login
        </h1>
        <p className="mt-1 ps-muted">Sign in to view your history and profile.</p>
      </div>

      {/* Content card */}
      <div className="ps-card">
        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {success}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Email or Username">
            <input
              className="ps-input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email or username"
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              className="ps-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
          </Field>

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="ps-btn ps-btn-primary w-full disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-2xl border border-emerald-200 bg-white/60 p-4 text-sm text-emerald-950/75">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Don’t have an account?</span>
            <Link
              to="/register"
              className="font-extrabold text-emerald-800 hover:underline"
            >
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs font-extrabold text-emerald-950/70 mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}
