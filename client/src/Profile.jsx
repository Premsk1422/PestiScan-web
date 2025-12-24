import { useState, useEffect } from "react";

export default function Profile() {
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ps_profile") || "{}");
      setProfile({ name: saved.name ?? "", email: saved.email ?? "" });
    } catch {}
  }, []);

  function handleChange(e) {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  }

  function saveProfile() {
    localStorage.setItem("ps_profile", JSON.stringify(profile));
    setStatus("Profile saved.");
    setTimeout(() => setStatus(""), 2000);
  }

  return (
    <div className="ps-page">
      {/* Page header OUTSIDE the card (matches Scan/History pattern) */}
      <div className="mb-5 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-emerald-950">
          Farmer Profile
        </h1>
        <p className="mt-1 ps-muted">Saved locally on this device.</p>
      </div>

      {/* Content in card */}
      <div className="ps-card">
        {status ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {status}
          </div>
        ) : null}

        <div className={status ? "mt-6 space-y-5" : "space-y-5"}>
          <Field label="Name">
            <input
              name="name"
              value={profile.name ?? ""}
              onChange={handleChange}
              className="ps-input"
              placeholder="Your name"
              autoComplete="name"
            />
          </Field>

          <Field label="Email">
            <input
              name="email"
              value={profile.email ?? ""}
              onChange={handleChange}
              className="ps-input"
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
            />
          </Field>

          <div className="pt-1">
            <button onClick={saveProfile} className="ps-btn ps-btn-primary">
              Save Profile
            </button>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white/60 p-4">
            <div className="text-xs font-extrabold text-emerald-950/70">
              Privacy note
            </div>
            <p className="mt-1 text-sm text-emerald-950/70 leading-relaxed">
              This page only stores your name and email in your browser’s local
              storage (ps_profile). Nothing is uploaded from this page.
            </p>
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
