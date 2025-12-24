import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, password }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          "Server did not return JSON. Check backend /api/auth/register route."
        );
      }

      if (!res.ok) throw new Error(data.error || "Registration failed");

      login(data.token);
      setSuccess("Registered successfully.");
      setTimeout(() => navigate("/scan"), 250);
    } catch (err) {
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ps-page">
      {/* Header outside card (matches Scan/History) */}
      <div className="mb-5 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-emerald-950">
          Register
        </h1>
        <p className="mt-1 ps-muted">
          Create an account to save scans and view your history.
        </p>
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
          <Field label="Full Name">
            <input
              className="ps-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              required
            />
          </Field>

          <Field label="Username">
            <input
              className="ps-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              className="ps-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              required
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              className="ps-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              autoComplete="new-password"
              required
            />
          </Field>

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="ps-btn ps-btn-primary w-full disabled:opacity-60"
            >
              {loading ? "Creating..." : "Register"}
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-2xl border border-emerald-200 bg-white/60 p-4 text-sm text-emerald-950/75">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Already have an account?</span>
            <Link
              to="/login"
              className="font-extrabold text-emerald-800 hover:underline"
            >
              Login here
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
