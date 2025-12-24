import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";

const LS_KEY = "pestiscan_history_v1";

/* ---------------- Helpers ---------------- */
function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function prettyLabel(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function levelColor(level) {
  const l = (level || "").toLowerCase();
  if (l.includes("high")) return { color: "#ef4444" };
  if (l.includes("medium")) return { color: "#eab308" };
  if (l.includes("low")) return { color: "#16a34a" };
  return { color: "rgba(15,61,42,0.92)" };
}

function riskBadgeStyle(level) {
  const l = (level || "").toLowerCase();

  let bg = "rgba(255,255,255,0.70)";
  let br = "rgba(15,61,42,0.12)";
  let fg = "rgba(15,61,42,0.92)";

  if (l.includes("high")) {
    bg = "rgba(239,68,68,0.10)";
    br = "rgba(239,68,68,0.25)";
    fg = "rgba(127,29,29,0.95)";
  }
  if (l.includes("medium")) {
    bg = "rgba(234,179,8,0.10)";
    br = "rgba(234,179,8,0.25)";
    fg = "rgba(120,53,15,0.95)";
  }
  if (l.includes("low")) {
    bg = "rgba(34,197,94,0.10)";
    br = "rgba(34,197,94,0.25)";
    fg = "rgba(20,83,45,0.95)";
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    background: bg,
    border: `1px solid ${br}`,
    color: fg,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

function clampNum(n, fallback = null) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function round1(n) {
  const x = clampNum(n, null);
  return x === null ? null : Math.round(x * 10) / 10;
}

function formatMaybe(n, unit = "") {
  const x = clampNum(n, null);
  if (x === null) return null;
  const r = round1(x);
  return `${r}${unit}`;
}

/**
 * Schema adapter:
 * Latest target: { inputs, weather, ai, result }
 * This keeps History tolerant to older saved shapes too.
 */
function normalizeItem(raw) {
  const it = raw || {};
  const inputs = it.inputs || it.payload?.inputs || it.request?.inputs || {};
  const result = it.result || it.response?.result || it.response || {};
  const ai = it.ai || it.meta?.ai || it.aiMeta || {};
  const weather = it.weather || it.meta?.weather || it.weatherMeta || inputs.weather || {};

  const createdAt = it.createdAt || it.fetchedAt || it.timestamp || it.date || null;

  // stress score could be in different places historically
  const stressScore =
    ai.stressScore ??
    ai.imageStress ??
    inputs.imageStress ?? // legacy
    result.aiStress ?? // legacy
    null;

  // symptoms could be different keys
  const symptoms = ai.symptoms || ai.symptomTags || result.symptoms || [];

  // confidence + meta (kept in data model for backward compatibility, UI hides it)
  const confidence = ai.confidence ?? result.confidence ?? null;
  const meta = ai.meta || ai.debug || {};

  return {
    ...it,
    id: it.id || it._id || String(createdAt || Date.now()),
    createdAt,
    inputs,
    weather,
    ai: {
      ...ai,
      stressScore,
      symptoms,
      confidence,
      meta,
    },
    result: {
      ...result,
      riskPercent: result.riskPercent ?? result.risk ?? result.score ?? 0,
      level: result.level ?? result.riskLevel ?? result.label ?? "—",
      breakdown: result.breakdown || result.components || {},
      tips: result.tips || result.notes || result.advice || [],
    },
  };
}

/* ---------------- Weather (human readable) ---------------- */
/**
 * ✅ UPDATED PER YOUR REQUEST:
 * - Removes Wind from summary + details
 * - Removes Fetched from summary + details
 * (keeps Temp, Humidity, Rain, Location, Source)
 */
function weatherToWords(weather) {
  const w = weather || {};

  const tempC = w.tempC ?? w.temperatureC ?? w.temperature ?? w.current?.temperature_2m ?? w.current?.temperature;
  const humidity = w.humidity ?? w.humidityPct ?? w.current?.relative_humidity_2m ?? w.current?.humidity;
  const rainfallMm =
    w.rainfallMm ??
    w.rainMm ??
    w.rain ??
    w.current?.rain ??
    w.current?.precipitation ??
    w.hourly?.rain?.[0];

  const lat = w.lat ?? w.latitude;
  const lon = w.lon ?? w.longitude;
  const source = w.source ?? w.provider ?? "Open-Meteo";

  const parts = [];

  const t = formatMaybe(tempC, "°C");
  const h = formatMaybe(humidity, "%");
  const r = formatMaybe(rainfallMm, " mm");

  if (t) parts.push(`Temperature ${t}`);
  if (h) parts.push(`Humidity ${h}`);
  if (r) parts.push(`Rain ${r}`);

  const hasAny = parts.length > 0;

  const coord =
    (clampNum(lat) !== null && clampNum(lon) !== null)
      ? `(${round1(lat)}, ${round1(lon)})`
      : null;

  const summary = hasAny
    ? `Weather: ${parts.join(", ")}${coord ? ` at ${coord}` : ""} (source: ${source}).`
    : "Weather: —";

  const details = {
    Temperature: t || "—",
    Humidity: h || "—",
    Rain: r || "—",
    Location: coord ? `(${round1(lat)}, ${round1(lon)})` : "—",
    Source: source || "—",
  };

  return { summary, details };
}

/* ---------------- PDF EXPORT ---------------- */
function exportHistoryPDF(items) {
  const doc = new jsPDF();
  let y = 14;

  doc.setFontSize(18);
  doc.text("PestiScan – Scan History", 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
  y += 10;

  if (!items.length) {
    doc.text("No scans available.", 14, y);
    doc.save("pestiscan-history.pdf");
    return;
  }

  items.forEach((raw, idx) => {
    const it = normalizeItem(raw);
    const w = weatherToWords(it.weather);

    if (y > 260) {
      doc.addPage();
      y = 14;
    }

    doc.setFontSize(12);
    doc.text(`Scan #${idx + 1}`, 14, y);
    y += 6;

    doc.setFontSize(10);
    doc.text(`Date: ${formatDate(it.createdAt)}`, 14, y); y += 5;
    doc.text(`Crop: ${it.inputs?.crop || "—"}`, 14, y); y += 5;
    doc.text(`Pesticide: ${it.inputs?.pesticide || "—"}`, 14, y); y += 5;
    doc.text(`Recommended Dose: ${it.inputs?.recommendedDose ?? "—"}`, 14, y); y += 5;
    doc.text(`Applied Dose: ${it.inputs?.appliedDose ?? "—"}`, 14, y); y += 5;
    doc.text(`Days Since Spray: ${it.inputs?.daysSinceSpray ?? "—"}`, 14, y); y += 5;
    doc.text(`Breakdown time: ${it.inputs?.halfLifeDays ?? "—"} days`, 14, y); y += 5;

    const stress = it.ai?.stressScore;
    doc.text(`AI Stress: ${stress == null ? "—" : `${Math.round(clampNum(stress, 0))}/100`}`, 14, y);
    y += 6;

    const weatherLine = w.summary.replace(/^Weather:\s*/i, "");
    const weatherWrapped = doc.splitTextToSize(`Weather: ${weatherLine}`, 180);
    weatherWrapped.forEach((line) => {
      if (y > 270) { doc.addPage(); y = 14; }
      doc.text(line, 14, y);
      y += 5;
    });
    y += 1;

    doc.setFontSize(11);
    doc.text(
      `Risk: ${Math.round(clampNum(it.result?.riskPercent, 0))}% (${it.result?.level || "—"})`,
      14,
      y
    );
    y += 6;

    if (it.ai?.symptoms?.length) {
      doc.setFontSize(10);
      const sym = `Symptoms: ${it.ai.symptoms.join(", ")}`;
      const symWrap = doc.splitTextToSize(sym, 180);
      symWrap.forEach((line) => {
        if (y > 270) { doc.addPage(); y = 14; }
        doc.text(line, 14, y);
        y += 5;
      });
      y += 1;
    }

    doc.setFontSize(10);
    doc.text("Breakdown:", 14, y);
    y += 5;

    const breakdown = it.result?.breakdown || {};
    const entries = Object.entries(breakdown);

    if (!entries.length) {
      doc.text("• —", 18, y);
      y += 4;
    } else {
      entries.forEach(([k, v]) => {
        if (y > 270) {
          doc.addPage();
          y = 14;
        }
        const num = Number(v);
        const val = Number.isFinite(num) ? num.toFixed(3) : String(v);
        doc.text(`• ${prettyLabel(k)}: ${val}`, 18, y);
        y += 4;
      });
    }

    const tips = it.result?.tips || [];
    if (tips.length) {
      y += 2;
      doc.text("Tips:", 14, y);
      y += 5;
      tips.forEach((t) => {
        if (y > 270) {
          doc.addPage();
          y = 14;
        }
        const wrap = doc.splitTextToSize(`- ${t}`, 175);
        wrap.forEach((line) => {
          if (y > 270) { doc.addPage(); y = 14; }
          doc.text(line, 18, y);
          y += 5;
        });
      });
    }

    y += 4;
    doc.line(14, y, 196, y);
    y += 8;
  });

  doc.save("pestiscan-history.pdf");
}

/* ---------------- UI Pieces ---------------- */
function KVGrid({ data }) {
  const entries = Object.entries(data || {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );

  if (!entries.length) return <div style={styles.muted}>—</div>;

  return (
    <div style={styles.kvGrid}>
      {entries.map(([k, v]) => (
        <div key={k} style={styles.kvItem}>
          <div style={styles.kvKey}>{prettyLabel(k)}</div>
          <div style={styles.kvVal}>{String(v)}</div>
        </div>
      ))}
    </div>
  );
}

function BreakdownTable({ breakdown }) {
  const entries = Object.entries(breakdown || {});
  if (!entries.length) return <div style={styles.muted}>—</div>;

  return (
    <div style={styles.table}>
      <div style={{ ...styles.tr, ...styles.thRow }}>
        <div style={styles.th}>Component</div>
        <div style={styles.th}>Value</div>
      </div>
      {entries.map(([k, v]) => {
        const num = Number(v);
        const val = Number.isFinite(num) ? num.toFixed(3) : String(v);
        return (
          <div key={k} style={styles.tr}>
            <div style={styles.td}>{prettyLabel(k)}</div>
            <div style={styles.tdMono}>{val}</div>
          </div>
        );
      })}
    </div>
  );
}

function WeatherCard({ weather }) {
  const { summary, details } = weatherToWords(weather);

  return (
    <div>
      <div style={styles.weatherSummary}>{summary}</div>
      <div style={{ marginTop: 10 }}>
        <KVGrid data={details} />
      </div>
    </div>
  );
}

/* ---------------- Main ---------------- */
export default function History() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = safeJsonParse(raw, []);
    setItems(Array.isArray(parsed) ? parsed : []);
  }, []);

  function persist(next) {
    setItems(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }

  function deleteOne(id) {
    const next = items.filter((x) => (x?.id || x?._id) !== id);
    persist(next);
    if ((selected?.id || selected?._id) === id) setSelected(null);
  }

  function clearAll() {
    persist([]);
    setSelected(null);
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items
      .map(normalizeItem)
      .filter((it) => {
        const lvl = (it?.result?.level || "").toLowerCase();
        const matchText =
          !q ||
          (it.inputs?.crop || "").toLowerCase().includes(q) ||
          (it.inputs?.pesticide || "").toLowerCase().includes(q);

        const matchRisk = riskFilter === "All" || lvl.includes(riskFilter.toLowerCase());
        return matchText && matchRisk;
      });
  }, [items, query, riskFilter]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>History</h1>
            <p style={styles.subTitle}>Saved scans on this device</p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={styles.primaryBtn}
              onClick={() => exportHistoryPDF(filtered)}
              disabled={!filtered.length}
              title="Export your filtered history to PDF"
            >
              Export PDF
            </button>
            <button
              style={styles.dangerBtn}
              onClick={clearAll}
              disabled={!items.length}
              title="Removes all saved scans from this device"
            >
              Clear all
            </button>
          </div>
        </header>

        <div style={styles.controls}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search crop / pesticide..."
            style={styles.search}
          />

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            style={styles.select}
          >
            <option>All</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>

        <div style={styles.card}>
          {!filtered.length ? (
            <div style={styles.empty}>No scans found</div>
          ) : (
            filtered.map((it) => (
              <div key={it.id} style={styles.row}>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.rowTop}>
                    <strong style={styles.rowTitle}>{it.inputs?.crop || "—"}</strong>
                    <span style={styles.dot}>•</span>
                    <span style={styles.rowSubtitle}>{it.inputs?.pesticide || "—"}</span>
                  </div>

                  <div style={styles.small}>{formatDate(it.createdAt)}</div>

                  <div style={styles.rowMeta}>
                    <span style={styles.pill}>
                      AI Stress:{" "}
                      {it.ai?.stressScore == null ? "—" : `${Math.round(clampNum(it.ai.stressScore, 0))}/100`}
                    </span>

                    {it.ai?.symptoms?.slice(0, 3).map((s) => (
                      <span key={s} style={styles.pillDim}>
                        {s}
                      </span>
                    ))}
                    {it.ai?.symptoms?.length > 3 && (
                      <span style={styles.pillDim}>+{it.ai.symptoms.length - 3} more</span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={riskBadgeStyle(it.result?.level)}>
                    <span>{Math.round(clampNum(it.result?.riskPercent, 0))}%</span>
                    <span style={{ opacity: 0.9 }}>({it.result?.level || "—"})</span>
                  </div>
                </div>

                <div style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                  <button style={styles.secondaryBtn} onClick={() => setSelected(it)}>
                    View
                  </button>
                  <button style={styles.dangerBtnSm} onClick={() => deleteOne(it.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {selected && (
          <div style={styles.modalOverlay} onClick={() => setSelected(null)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div style={styles.modalHeader}>
                <div>
                  <div style={styles.modalTitle}>Scan details</div>
                  <div style={styles.small}>{formatDate(selected.createdAt)}</div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={riskBadgeStyle(selected.result?.level)}>
                    <span style={{ ...levelColor(selected.result?.level) }}>
                      {selected.result?.level || "—"}
                    </span>
                    <span style={{ opacity: 0.9 }}>
                      {Math.round(clampNum(selected.result?.riskPercent, 0))}%
                    </span>
                  </div>

                  <button style={styles.iconBtn} onClick={() => setSelected(null)} title="Close">
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div style={styles.modalBody}>
                <section style={styles.section}>
                  <div style={styles.sectionTitle}>Risk summary</div>
                  <div style={styles.summaryStrip}>
                    <div style={styles.summaryBox}>
                      <div style={styles.kvKey}>Risk</div>
                      <div style={styles.summaryBig}>
                        {Math.round(clampNum(selected.result?.riskPercent, 0))}%
                      </div>
                    </div>
                    <div style={styles.summaryBox}>
                      <div style={styles.kvKey}>Level</div>
                      <div style={{ ...styles.summaryBig, ...levelColor(selected.result?.level) }}>
                        {selected.result?.level || "—"}
                      </div>
                    </div>
                    <div style={styles.summaryBox}>
                      <div style={styles.kvKey}>AI stress</div>
                      <div style={styles.summaryBig}>
                        {selected.ai?.stressScore == null ? "—" : `${Math.round(clampNum(selected.ai.stressScore, 0))}/100`}
                      </div>
                    </div>
                  </div>

                  <div style={styles.disclaimer}>
                    Disclaimer: AI stress is a heuristic proxy (v1.0). Always follow label instructions and waiting intervals.
                  </div>
                </section>

                {/* ✅ Inputs: WEATHER REMOVED from Inputs section */}
                <section style={styles.section}>
                  <div style={styles.sectionTitle}>Inputs</div>
                  <KVGrid
                    data={(() => {
                      const base = { ...(selected.inputs || {}) };
                      // remove weather if present inside inputs
                      if (base.weather) delete base.weather;
                      return base;
                    })()}
                  />
                </section>

                {/* ✅ Weather stays, but Wind + Fetched removed in weatherToWords */}
                <section style={styles.section}>
                  <div style={styles.sectionTitle}>Weather</div>
                  <WeatherCard weather={selected.weather} />
                </section>

                {/* ✅ AI section: remove Confidence + AI meta */}
                <section style={styles.section}>
                  <div style={styles.sectionTitle}>AI (heuristic)</div>
                  <div style={styles.aiRow}>
                    <div style={styles.aiCard}>
                      <div style={styles.aiKey}>Stress score</div>
                      <div style={styles.aiVal}>
                        {selected.ai?.stressScore == null ? "—" : `${Math.round(clampNum(selected.ai.stressScore, 0))}/100`}
                      </div>
                    </div>

                    <div style={styles.aiCard}>
                      <div style={styles.aiKey}>Symptoms</div>
                      <div style={{ marginTop: 8 }}>
                        <div style={styles.chips}>
                          {selected.ai?.symptoms?.length ? (
                            selected.ai.symptoms.map((s) => (
                              <span key={s} style={styles.chip}>
                                {s}
                              </span>
                            ))
                          ) : (
                            <span style={styles.muted}>—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section style={styles.section}>
                  <div style={styles.sectionTitle}>Risk breakdown</div>
                  <BreakdownTable breakdown={selected.result?.breakdown} />
                </section>

                <section style={styles.section}>
                  <div style={styles.sectionTitle}>Safety notes</div>
                  <ul style={styles.ul}>
                    <li>Follow label instructions and harvest intervals.</li>
                    <li>This is a guidance tool, not medical/legal advice.</li>
                    <li>Weather + AI inputs can be noisy; verify with field conditions.</li>
                  </ul>
                </section>
              </div>

              {/* Footer */}
              <div style={styles.modalFooter}>
                <button
                  style={styles.secondaryBtn}
                  onClick={() => exportHistoryPDF([selected])}
                  title="Export only this scan to PDF"
                >
                  Export this scan (PDF)
                </button>

                <button
                  style={styles.dangerBtn}
                  onClick={() => deleteOne(selected.id)}
                  title="Delete this scan"
                >
                  Delete scan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Styles (match Scan + new green theme) ---------------- */
const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px 14px",
    background:
      "radial-gradient(900px 500px at 15% 0%, rgba(38,199,102,0.18), transparent 60%)," +
      "radial-gradient(900px 500px at 85% 10%, rgba(245,191,90,0.16), transparent 55%)," +
      "radial-gradient(900px 600px at 50% 100%, rgba(80,170,255,0.10), transparent 60%)," +
      "rgba(38,199,102,0.06)",
    color: "rgba(15,61,42,0.92)",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },
  container: { maxWidth: 980, margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  title: { margin: 0, fontSize: 28, letterSpacing: 0.2 },
  subTitle: { color: "rgba(15,61,42,0.62)", margin: "6px 0 0" },

  controls: { display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  search: {
    flex: 1,
    minWidth: 220,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(15,61,42,0.12)",
    background: "rgba(255,255,255,0.85)",
    color: "rgba(15,61,42,0.92)",
    outline: "none",
  },
  select: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(15,61,42,0.12)",
    background: "rgba(255,255,255,0.85)",
    color: "rgba(15,61,42,0.92)",
    outline: "none",
  },

  card: {
    border: "1px solid rgba(15,61,42,0.10)",
    background: "rgba(255,255,255,0.78)",
    borderRadius: 18,
    padding: 8,
    boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
  },

  row: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr auto",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
    border: "1px solid rgba(15,61,42,0.08)",
    background: "rgba(255,255,255,0.70)",
    margin: 8,
  },
  rowTop: { display: "flex", alignItems: "baseline", gap: 8, minWidth: 0, flexWrap: "wrap" },
  rowTitle: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  rowSubtitle: { opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  dot: { opacity: 0.35 },
  rowMeta: { display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" },

  small: { fontSize: 12, opacity: 0.65 },
  muted: { opacity: 0.7 },

  pill: {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(38,199,102,0.10)",
    border: "1px solid rgba(38,199,102,0.22)",
    color: "rgba(15,61,42,0.92)",
    fontWeight: 800,
  },
  pillDim: {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.80)",
    border: "1px solid rgba(15,61,42,0.10)",
    opacity: 0.95,
    color: "rgba(15,61,42,0.92)",
    fontWeight: 700,
  },

  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(38,199,102,0.45)",
    background: "rgba(38,199,102,0.16)",
    color: "rgba(15,61,42,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },
  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,61,42,0.14)",
    background: "rgba(255,255,255,0.85)",
    color: "rgba(15,61,42,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },
  dangerBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.30)",
    background: "rgba(239,68,68,0.10)",
    color: "rgba(127,29,29,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },
  dangerBtnSm: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.30)",
    background: "rgba(239,68,68,0.08)",
    color: "rgba(127,29,29,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },
  empty: { textAlign: "center", padding: 20, opacity: 0.65 },

  /* Modal */
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 50,
  },
  modal: {
    width: "min(980px, 96vw)",
    border: "1px solid rgba(15,61,42,0.12)",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 20px 80px rgba(0,0,0,0.35)",
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(10px)",
  },
  modalHeader: {
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(15,61,42,0.10)",
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(10px)",
  },
  modalTitle: { fontSize: 16, fontWeight: 900, letterSpacing: 0.2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(15,61,42,0.14)",
    background: "rgba(255,255,255,0.85)",
    color: "rgba(15,61,42,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },
  modalBody: { padding: 14, maxHeight: "72vh", overflow: "auto" },
  modalFooter: {
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    borderTop: "1px solid rgba(15,61,42,0.10)",
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(10px)",
  },

  section: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 16,
    background: "rgba(38,199,102,0.06)",
    border: "1px solid rgba(15,61,42,0.10)",
  },
  sectionTitle: { fontWeight: 900, marginBottom: 10, opacity: 0.92 },

  summaryStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 8,
  },
  summaryBox: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(15,61,42,0.10)",
  },
  summaryBig: { fontSize: 22, fontWeight: 900, marginTop: 6 },

  kvGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 },
  kvItem: {
    padding: 10,
    borderRadius: 14,
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(15,61,42,0.10)",
  },
  kvKey: { fontSize: 12, opacity: 0.65, marginBottom: 6 },
  kvVal: { fontSize: 14, wordBreak: "break-word" },

  aiRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  aiCard: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(15,61,42,0.10)",
  },
  aiKey: { fontSize: 12, opacity: 0.7, marginBottom: 6 },
  aiVal: { fontSize: 22, fontWeight: 900 },

  chips: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 },
  chip: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(38,199,102,0.12)",
    border: "1px solid rgba(38,199,102,0.22)",
    color: "rgba(15,61,42,0.92)",
    fontWeight: 800,
  },

  disclaimer: { marginTop: 12, fontSize: 12, opacity: 0.7 },

  table: { borderRadius: 14, overflow: "hidden", border: "1px solid rgba(15,61,42,0.10)" },
  tr: { display: "grid", gridTemplateColumns: "1fr 140px", gap: 0 },
  thRow: { background: "rgba(38,199,102,0.10)" },
  th: { padding: 10, fontWeight: 900, fontSize: 12, opacity: 0.9, borderBottom: "1px solid rgba(15,61,42,0.10)" },
  td: { padding: 10, borderBottom: "1px solid rgba(15,61,42,0.08)" },
  tdMono: {
    padding: 10,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    borderBottom: "1px solid rgba(15,61,42,0.08)",
  },

  ul: { margin: 0, paddingLeft: 18, opacity: 0.85 },

  weatherSummary: {
    padding: 10,
    borderRadius: 14,
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(15,61,42,0.10)",
    fontSize: 14,
    lineHeight: 1.4,
  },
};
