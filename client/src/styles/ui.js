// client/src/styles/ui.js
export const ui = {
  page: { minHeight: "100vh", background: "#0b0f12", color: "#fff" },
  container: { maxWidth: 1000, margin: "0 auto", padding: 16 },

  card: {
    background: "#0f1419",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  },

  input: {
    width: "100%",
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#0b0f12",
    color: "#fff",
    outline: "none",
  },

  select: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#0b0f12",
    color: "#fff",
  },

  btn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },

  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background: "#22c55e",
    color: "#04120a",
    cursor: "pointer",
    fontWeight: 800,
  },

  btnDanger: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background: "#ef4444",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800,
  },

  pill: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.22)",
  },

  muted: { opacity: 0.7 },
  small: { fontSize: 12, opacity: 0.7 },

  bannerInfo: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(59,130,246,0.12)",
    border: "1px solid rgba(59,130,246,0.22)",
  },

  bannerError: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.22)",
  },
};
