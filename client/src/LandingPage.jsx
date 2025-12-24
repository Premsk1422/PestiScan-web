import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="ps-page">
      {/* HERO */}
      {/* Add top padding so the dropdown never visually collides with hero heading */}
      <div className="pt-2 md:pt-4">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Left */}
          <section>
            <div className="ps-badge">AI-guided • Farmer-friendly • Demo-ready</div>

            {/* Keep title readable + not cramped */}
            <h1
              style={{
                marginTop: 16,
                fontSize: "clamp(34px, 4vw, 48px)",
                fontWeight: 900,
                lineHeight: 1.06,
                letterSpacing: -0.3,
              }}
            >
              PestiScan
            </h1>

            <p style={{ marginTop: 14, lineHeight: 1.75 }} className="ps-muted">
              Upload a leaf photo, enter a few farm details, and get a clear risk % with
              farmer-friendly recommendations for safer harvest decisions.
            </p>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <Link to="/scan" className="ps-btn ps-btn-primary">
                Start Scanning →
              </Link>

              <Link
                to="/history"
                className="ps-btn"
                style={{
                  border: "1px solid var(--ps-green-border)",
                  background: "rgba(255,255,255,0.85)",
                }}
              >
                View History
              </Link>
            </div>

            <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6 }} className="ps-muted">
              Note: PestiScan is a guidance tool. Always follow pesticide label instructions.
            </div>
          </section>

          {/* Right */}
          <section className="ps-card">
            <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>
              How it works
            </h2>

            {/* ✅ Numbering FIX: "1.  content" stays together */}
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <Step n="1." title="Upload a clear leaf photo">
                Use natural light, avoid blur, and keep the leaf filling the frame.
              </Step>

              <Step n="2." title="Enter farm conditions">
                Days since spray, dose, moisture, leaf/soil pH, and weather (auto-fill if needed).
              </Step>

              <Step n="3." title="Get risk % and advice">
                A clear risk level, explanation, and recommendations you can act on.
              </Step>
            </div>
          </section>
        </div>
      </div>

      {/* SECOND CARD */}
      <div className="ps-card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>
          What you get
        </h2>

        <div style={{ marginTop: 12 }} className="ps-muted">
          <div style={{ display: "grid", gap: 10, lineHeight: 1.7 }}>
            <div>• Risk percentage + clear level (Low / Medium / High)</div>
            <div>• AI stress estimate from the leaf photo</div>
            <div>• Breakdown + simple recommendations you can follow</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: "1px solid rgba(38,199,102,0.25)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          fontSize: 13,
        }}
        className="ps-muted"
      >
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          © {new Date().getFullYear()} PestiScan — For safer harvests.
        </p>

        <nav style={{ display: "flex", gap: 14 }}>
          <Link to="/about" style={{ textDecoration: "none" }}>
            About
          </Link>
          <Link to="/contact" style={{ textDecoration: "none" }}>
            Contact
          </Link>
        </nav>
      </footer>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="ps-step">
      <div className="ps-step-num">{n}</div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 900, lineHeight: 1.25 }}>{title}</div>
        <div className="ps-muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
