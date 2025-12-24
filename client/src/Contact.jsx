import React, { useMemo, useState } from "react";

export default function Contact() {
  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [topic, setTopic] = useState("Farmer support");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  const CONTACT_EMAIL = "premsk2011@gmail.com";
  const WHATSAPP_NUMBER = "+679 8342954";

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`PestiScan — ${topic}`);
    const body = encodeURIComponent(
      `Name: ${name || "—"}\nEmail: ${fromEmail || "—"}\nTopic: ${topic}\n\n${message || ""}\n\n— Sent from PestiScan Web`
    );
    return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }, [name, fromEmail, topic, message]);

  const whatsappHref = useMemo(() => {
    const digits = WHATSAPP_NUMBER.replace(/[^\d]/g, "");
    const text = encodeURIComponent(
      `Hi, I'm contacting about PestiScan.\nTopic: ${topic}\nName: ${name || "—"}\nEmail: ${fromEmail || "—"}\n\n${message || ""}`
    );
    return `https://wa.me/${digits}?text=${text}`;
  }, [name, fromEmail, topic, message]);

  function onSubmit(e) {
    e.preventDefault();
    setStatus("");
    if (!message.trim()) {
      setStatus("Please write a short message so we know how to help.");
      return;
    }
    window.location.href = mailtoHref;
    setStatus("Opening your email app… If it doesn’t open, use the buttons below.");
  }

  return (
    <div className="ps-page">
      {/* Header */}
      <header style={{ marginBottom: 14 }}>
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
          Contact
        </h1>
        <p className="ps-muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
          Farmer support, feedback, partnerships, and collaboration — all welcome.
        </p>
      </header>

      {/* Main card */}
      <div className="ps-card">
        {status ? (
          <div
            style={{
              marginBottom: 12,
              borderRadius: 14,
              border: "1px solid var(--ps-green-border)",
              background: "var(--ps-green-soft)",
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {status}
          </div>
        ) : null}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div style={{ minWidth: 0 }}>
              <Label>Topic</Label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="ps-input"
                style={{ cursor: "pointer" }}
              >
                <option>Farmer support</option>
                <option>Feedback</option>
                <option>Partnership / Investor</option>
                <option>Research / Collaboration</option>
                <option>Other</option>
              </select>
            </div>

            <div style={{ minWidth: 0 }}>
              <Label>Your email</Label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="ps-input"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <Label>Name</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ps-input"
              placeholder="Your name"
            />
          </div>

          <div>
            <Label>Message</Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="ps-input"
              style={{ resize: "none" }}
              placeholder="Write your message…"
              required
            />
            <div className="ps-muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
              Tip: Include crop name, pesticide name, and what issue you’re facing for faster help.
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            <button type="submit" className="ps-btn ps-btn-primary">
              Send via Email →
            </button>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="ps-btn"
              style={{
                border: "1px solid var(--ps-green-border)",
                background: "white",
                color: "var(--ps-text)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              WhatsApp
            </a>

            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="ps-btn"
              style={{
                border: "1px solid var(--ps-green-border)",
                background: "white",
                color: "var(--ps-text)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Open a blank email"
            >
              Email: {CONTACT_EMAIL}
            </a>
          </div>

          {/* Footer info */}
          <div
            className="ps-muted"
            style={{
              marginTop: 8,
              paddingTop: 10,
              borderTop: "1px solid rgba(38, 199, 102, 0.18)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            WhatsApp: <b style={{ color: "var(--ps-text)" }}>{WHATSAPP_NUMBER}</b>
          </div>
        </form>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8, opacity: 0.72 }}>
      {children}
    </div>
  );
}
