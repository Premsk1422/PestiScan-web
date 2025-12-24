import React from "react";

export default function About() {
  return (
    <div className="ps-page">
      <div style={{ display: "grid", gap: 14 }}>
        {/* Header */}
        <header>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(30px, 3.2vw, 40px)",
              fontWeight: 900,
              letterSpacing: -0.3,
              lineHeight: 1.1,
              color: "var(--ps-text)",
            }}
          >
            About PestiScan
          </h1>
          <p className="ps-muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
            AI-guided pesticide risk support for safer harvest decisions.
          </p>
        </header>

        {/* Main card */}
        <section className="ps-card">
          <p style={{ marginTop: 0, lineHeight: 1.75 }}>
            <strong>PestiScan</strong> helps farmers estimate pesticide risk using a leaf photo
            (AI visual stress estimate) and farm conditions such as dose, days since spray,
            moisture, leaf/soil pH, and weather.
          </p>

          <p style={{ lineHeight: 1.75 }}>
            The goal is simple: show a clear <strong>risk percentage</strong> and easy recommendations
            so you can decide whether to harvest now or wait longer.
          </p>

          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid var(--ps-green-border)",
              background: "var(--ps-green-soft)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
            className="ps-muted"
          >
            <strong>Important:</strong> PestiScan is a guidance tool and not a lab residue test. Always
            follow pesticide label instructions and local agricultural recommendations.
          </div>
        </section>

        {/* Optional second card (fits the vibe and makes page feel “complete”) */}
        <section className="ps-card">
          <h2 style={{ marginTop: 0, fontSize: 16, fontWeight: 900 }}>
            What we consider in the estimate
          </h2>

          <div style={{ display: "grid", gap: 8, marginTop: 10 }} className="ps-muted">
            <div>• Leaf photo stress (AI estimate)</div>
            <div>• Dose vs recommended amount</div>
            <div>• Days since last spray + pesticide breakdown time</div>
            <div>• Leaf/soil pH + soil moisture</div>
            <div>• Weather (heat, humidity, rain)</div>
          </div>
        </section>
      </div>
    </div>
  );
}
