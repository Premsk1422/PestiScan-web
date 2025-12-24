import React, { useMemo, useState } from "react";
import { analyzeLeafPhoto } from "./utils/leafVision.js";

const LS_KEY = "pestiscan_history_v1";

// ✅ Step 3 toggle: AI stress ON, blocker OFF by default
const ENABLE_IMAGE_BLOCKER = false; // turn true later when you want strict blocking
const ENABLE_TEST_PRESETS = true; // Step 5 quick test pack buttons

function clampNum(v, min, max) {
  const n = Number(v);
  if (Number.isNaN(n)) return "";
  return Math.min(max, Math.max(min, n));
}

function safeJsonParse(s, fallback = null) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function prettyLabel(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function normalizeResult(raw) {
  const riskPercent =
    raw?.riskPercent ??
    raw?.risk ??
    raw?.risk_percentage ??
    raw?.result?.riskPercent ??
    raw?.result?.risk ??
    null;

  const level =
    raw?.level ??
    raw?.riskLevel ??
    raw?.result?.level ??
    raw?.result?.riskLevel ??
    "—";

  const breakdown =
    raw?.breakdown ??
    raw?.components ??
    raw?.details ??
    raw?.result?.breakdown ??
    raw?.result?.components ??
    {};

  const tips = raw?.tips ?? raw?.advice ?? raw?.result?.tips ?? [];

  return {
    riskPercent: typeof riskPercent === "number" ? riskPercent : Number(riskPercent),
    level,
    breakdown: breakdown && typeof breakdown === "object" ? breakdown : {},
    tips: Array.isArray(tips) ? tips : [],
    raw,
  };
}

function getRiskMeta(level, riskPercent) {
  const L = String(level || "").toLowerCase();
  // prefer explicit level
  if (L.includes("high")) return { label: "High", tone: "red", reasonHint: "spray was recent or dose was high" };
  if (L.includes("medium")) return { label: "Medium", tone: "amber", reasonHint: "some factors are elevated" };
  if (L.includes("low")) return { label: "Low", tone: "green", reasonHint: "spray is older or dose is moderate" };

  // fallback from percent
  if (typeof riskPercent === "number") {
    if (riskPercent >= 70) return { label: "High", tone: "red", reasonHint: "spray was recent or dose was high" };
    if (riskPercent >= 40) return { label: "Medium", tone: "amber", reasonHint: "some factors are elevated" };
    return { label: "Low", tone: "green", reasonHint: "spray is older or dose is moderate" };
  }
  return { label: "—", tone: "neutral", reasonHint: "insufficient data returned" };
}

function makePlainEnglishReason(inputs, resultMeta) {
  const reasons = [];

  if (Number(inputs?.daysSinceSpray) <= 2) reasons.push("spray was very recent");
  if (Number(inputs?.recommendedDose) > 1.2) reasons.push("dose was higher than recommended");
  if (Number(inputs?.halfLifeDays) >= 10) reasons.push("pesticide breaks down slowly");
  if (Number(inputs?.weather?.tempC) >= 35) reasons.push("hot weather can increase stress");
  if (Number(inputs?.weather?.humidity) >= 80) reasons.push("high humidity can increase disease/stress");
  if (Number(inputs?.imageStress) >= 60) reasons.push("leaf looks stressed in the photo");

  if (reasons.length === 0) return `Estimated ${resultMeta.label} risk based on your inputs.`;
  // Keep it short + farmer-friendly
  return `${resultMeta.label} risk mainly because ${reasons.slice(0, 2).join(" and ")}.`;
}

async function fetchWeatherOpenMeteo(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    `&current=temperature_2m,rain` +
    `&hourly=relative_humidity_2m,precipitation` +
    `&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather fetch failed");
  const data = await res.json();

  const tempC = data?.current?.temperature_2m ?? null;
  const rainNow = data?.current?.rain ?? 0;

  // closest humidity to "current time"
  let humidity = null;
  try {
    const times = data?.hourly?.time || [];
    const hums = data?.hourly?.relative_humidity_2m || [];
    const nowIso = data?.current?.time;
    const idx = times.indexOf(nowIso);
    humidity = idx >= 0 ? hums[idx] : hums[0];
  } catch {
    humidity = null;
  }

  // sum hourly precipitation as rough "last 24h"
  let rainMm24h = null;
  try {
    const p = data?.hourly?.precipitation || [];
    rainMm24h = p.reduce((a, b) => a + (Number(b) || 0), 0);
  } catch {
    rainMm24h = null;
  }

  return {
    tempC: typeof tempC === "number" ? tempC : null,
    humidity: typeof humidity === "number" ? humidity : null,
    rainMm24h: typeof rainMm24h === "number" ? rainMm24h : (typeof rainNow === "number" ? rainNow : 0),
  };
}

const TEST_PRESETS = [
  {
    name: "Low risk (baseline)",
    crop: "Tomato",
    pesticide: "Generic",
    recommendedDose: 1,
    daysSinceSpray: 10,
    halfLifeDays: 5,
    leafPh: 6.5,
    soilPh: 6.8,
    soilMoisture: 55,
    tempC: 27,
    humidity: 55,
    rainMm24h: 0,
  },
  {
    name: "Medium (recent spray)",
    crop: "Chilli",
    pesticide: "Mancozeb",
    recommendedDose: 1,
    daysSinceSpray: 2,
    halfLifeDays: 7,
    leafPh: 6.2,
    soilPh: 6.5,
    soilMoisture: 45,
    tempC: 32,
    humidity: 65,
    rainMm24h: 2,
  },
  {
    name: "High (high dose + heat)",
    crop: "Orchid",
    pesticide: "Generic",
    recommendedDose: 2.2,
    daysSinceSpray: 1,
    halfLifeDays: 10,
    leafPh: 5.6,
    soilPh: 5.8,
    soilMoisture: 35,
    tempC: 38,
    humidity: 78,
    rainMm24h: 0,
  },
];

export default function Scan() {
  const [step, setStep] = useState(1);

  // image
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // AI analysis + (optional) gate signals
  const [imageStress, setImageStress] = useState(25);
  const [symptoms, setSymptoms] = useState([]);
  const [photoWarn, setPhotoWarn] = useState(""); // warning text only (no blocking)
  const [photoMetrics, setPhotoMetrics] = useState(null); // debug

  // inputs
  const [crop, setCrop] = useState("Tomato");
  const [pesticide, setPesticide] = useState("Generic");
  const [dose, setDose] = useState(1); // UI name "dose", payload uses recommendedDose
  const [daysSinceSpray, setDaysSinceSpray] = useState(3);
  const [halfLifeDays, setHalfLifeDays] = useState(7);

  const [leafPh, setLeafPh] = useState(6.5);
  const [soilPh, setSoilPh] = useState(6.8);
  const [soilMoisture, setSoilMoisture] = useState(55);

  // weather
  const [tempC, setTempC] = useState(30);
  const [humidity, setHumidity] = useState(60);
  const [rainMm24h, setRainMm24h] = useState(0);
  const [weatherStatus, setWeatherStatus] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(false);

  // UX
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const inputs = useMemo(
    () => ({
      crop,
      pesticide,
      recommendedDose: Number(dose),
      daysSinceSpray: Number(daysSinceSpray),
      halfLifeDays: Number(halfLifeDays),
      leafPh: Number(leafPh),
      soilPh: Number(soilPh),
      soilMoisture: Number(soilMoisture),
      weather: {
        tempC: Number(tempC),
        humidity: Number(humidity),
        rainMm24h: Number(rainMm24h),
      },
      imageStress: Number(imageStress),
      symptoms,
    }),
    [
      crop,
      pesticide,
      dose,
      daysSinceSpray,
      halfLifeDays,
      leafPh,
      soilPh,
      soilMoisture,
      tempC,
      humidity,
      rainMm24h,
      imageStress,
      symptoms,
    ]
  );

  const resultMeta = useMemo(() => {
    const rp = result?.riskPercent;
    return getRiskMeta(result?.level, typeof rp === "number" ? rp : null);
  }, [result]);

  function resetAll() {
    setStep(1);
    setImageFile(null);
    setImagePreview("");
    setImageStress(25);
    setSymptoms([]);
    setPhotoWarn("");
    setPhotoMetrics(null);

    setResult(null);
    setError("");
    setLoading(false);

    setWeatherStatus("");
  }

  function saveToHistory(record) {
    const existing = safeJsonParse(localStorage.getItem(LS_KEY), []);
    const arr = Array.isArray(existing) ? existing : [];
    arr.unshift(record);
    localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, 50)));
  }

  async function onPickImage(file) {
    setError("");
    setResult(null);
    setPhotoWarn("");
    setPhotoMetrics(null);
    setSymptoms([]);

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG/PNG/WebP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image too large. Please keep it under 8 MB.");
      return;
    }

    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);

    // ✅ AI stress always runs
    try {
      const analysis = await analyzeLeafPhoto(file);
      setImageStress(analysis.imageStress);
      setSymptoms(analysis.symptoms || []);
      setPhotoMetrics(analysis.metrics || null);

      // 🚫 Blocker OFF by default: only warn
      if (!analysis.ok) {
        setPhotoWarn(
          "Photo quality looks low (best-effort check). We will still allow scanning, but results may be less accurate."
        );
      } else {
        setPhotoWarn("");
      }

      // If you later enable strict mode:
      if (ENABLE_IMAGE_BLOCKER && !analysis.ok) {
        setError("Photo not acceptable. Please upload a clear real leaf photo.");
        setStep(1);
        return;
      }

      setStep(2);
    } catch {
      // If AI fails for any reason, still allow the scan with a neutral default
      setPhotoWarn("Couldn’t analyze leaf stress from this photo. You can still continue.");
      setImageStress(25);
      setSymptoms([]);
      setStep(2);
    }
  }

  async function useMyWeather() {
    setWeatherStatus("");
    setWeatherLoading(true);
    try {
      if (!navigator.geolocation) {
        setWeatherStatus("Geolocation not available. Enter weather manually.");
        return;
      }

      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 9000,
          maximumAge: 60_000,
        });
      });

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      const w = await fetchWeatherOpenMeteo(lat, lon);
      if (typeof w.tempC === "number") setTempC(Math.round(w.tempC * 10) / 10);
      if (typeof w.humidity === "number") setHumidity(Math.round(w.humidity));
      if (typeof w.rainMm24h === "number") setRainMm24h(Math.round(w.rainMm24h * 10) / 10);

      setWeatherStatus("Weather auto-filled from your location.");
    } catch {
      setWeatherStatus("Couldn’t fetch weather. You can enter values manually.");
    } finally {
      setWeatherLoading(false);
    }
  }

  async function onAnalyze() {
    setError("");
    setLoading(true);
    setResult(null);

    try {
      if (!imageFile) throw new Error("Please upload a leaf photo first.");

      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("inputs", JSON.stringify(inputs));

      const res = await fetch("/api/scan", { method: "POST", body: fd });

      const text = await res.text();
      const data = safeJsonParse(text, { error: text || "Unknown error" });
      if (!res.ok) throw new Error(data?.error || "Scan failed. Please try again.");

      const normalized = normalizeResult(data);
      if (Number.isNaN(normalized.riskPercent)) normalized.riskPercent = null;

      setResult(normalized);
      setStep(4);

      saveToHistory({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        inputs,
        result: {
          riskPercent: normalized.riskPercent,
          level: normalized.level,
          breakdown: normalized.breakdown,
          tips: normalized.tips,
        },
        image: { name: imageFile.name, type: imageFile.type, size: imageFile.size },
        ai: { imageStress, symptoms, metrics: photoMetrics },
      });
    } catch (e) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(p) {
    setCrop(p.crop);
    setPesticide(p.pesticide);
    setDose(p.recommendedDose);
    setDaysSinceSpray(p.daysSinceSpray);
    setHalfLifeDays(p.halfLifeDays);
    setLeafPh(p.leafPh);
    setSoilPh(p.soilPh);
    setSoilMoisture(p.soilMoisture);
    setTempC(p.tempC);
    setHumidity(p.humidity);
    setRainMm24h(p.rainMm24h);
  }

  // ✅ phase-2 microcopy improvements (display labels only)
  const copy = {
    halfLifeLabel: "Pesticide breakdown time (days)",
    halfLifeHelp: "How fast the pesticide breaks down (approx). Larger = stays longer.",
    aiStressLabel: "Leaf stress detected from photo (AI estimate)",
    daysSinceSprayLabel: "Days since last pesticide spray",
  };

  const plainReason = useMemo(() => {
    if (!result) return "";
    return makePlainEnglishReason(inputs, resultMeta);
  }, [inputs, result, resultMeta]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>PestiScan</h1>
            <p style={styles.subTitle}>Upload → Inputs → Analyze → Result</p>
          </div>
          <button onClick={resetAll} style={styles.secondaryBtn}>New scan</button>
        </header>

        <div style={styles.stepper}>
          {["Upload", "Inputs", "Analyze", "Result"].map((label, i) => {
            const idx = i + 1;
            const active = idx === step;
            const done = idx < step;
            return (
              <div
                key={label}
                style={{
                  ...styles.step,
                  ...(active ? styles.stepActive : {}),
                  ...(done ? styles.stepDone : {}),
                }}
              >
                <span style={styles.stepNum}>{idx}</span>
                <span>{label}</span>
              </div>
            );
          })}
        </div>

        {error ? <div style={styles.errorBanner}>{error}</div> : null}
        {photoWarn ? <div style={styles.warnBanner}>{photoWarn}</div> : null}

        {/* STEP 1 */}
        {step === 1 && (
          <div style={styles.card}>
            <h2 style={styles.h2}>1) Upload a leaf photo</h2>
            <p style={styles.p}>
              We auto-calculate <b>{copy.aiStressLabel}</b>.
              <span style={styles.smallMuted}> (Blocking is currently OFF.)</span>
            </p>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPickImage(e.target.files?.[0])}
              style={styles.file}
            />

            <div style={styles.hintBox}>
              <div style={styles.hintTitle}>Photo tips</div>
              <ul style={styles.ul}>
                {/* Numbering fix in list: keeps bullet text aligned */}
                <li style={styles.liFixed}>Close-up leaf, fill most of the frame</li>
                <li style={styles.liFixed}>Natural light, avoid heavy filters</li>
                <li style={styles.liFixed}>Sharp focus (not blurry)</li>
              </ul>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={styles.grid2}>
            <div style={styles.card}>
              <h2 style={styles.h2}>2) Photo + AI stress</h2>
              {imagePreview ? (
                <img alt="Leaf preview" src={imagePreview} style={styles.previewImg} />
              ) : (
                <div style={styles.previewPlaceholder}>No image</div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <span style={styles.badge} title="AI estimate of visible leaf stress (0–100)">
                  AI Stress: {imageStress}/100
                </span>
                {symptoms?.map((s) => (
                  <span key={s} style={styles.tag}>{s}</span>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button style={styles.secondaryBtn} onClick={() => setStep(1)}>
                  Change photo
                </button>
                <button style={styles.primaryBtn} onClick={() => setStep(3)}>
                  Continue
                </button>
              </div>

              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer" }}>Debug (photo metrics)</summary>
                <pre style={styles.pre}>{JSON.stringify(photoMetrics, null, 2)}</pre>
              </details>
            </div>

            <div style={styles.card}>
              <h2 style={styles.h2}>Inputs</h2>

              {ENABLE_TEST_PRESETS ? (
                <div style={styles.cardSoft}>
                  <div style={styles.cardSoftTitle}>Step 5: Test pack (quick)</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {TEST_PRESETS.map((p) => (
                      <button key={p.name} style={styles.secondaryBtnSm} onClick={() => applyPreset(p)}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <div style={styles.smallMuted}>(Use these to quickly check stability + calibrate later.)</div>
                </div>
              ) : null}

              <div style={styles.row2}>
                <div style={styles.field}>
                  <label style={styles.label}>Crop</label>
                  <input value={crop} onChange={(e) => setCrop(e.target.value)} style={styles.input} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Pesticide</label>
                  <input value={pesticide} onChange={(e) => setPesticide(e.target.value)} style={styles.input} />
                </div>
              </div>

              <div style={styles.row2}>
                <div style={styles.field}>
                  <label style={styles.label} title="1 = recommended dose. Higher values mean heavier dose.">
                    Dose used (relative)
                  </label>
                  <input
                    type="number"
                    value={dose}
                    onChange={(e) => setDose(clampNum(e.target.value, 0.1, 10))}
                    style={styles.input}
                    step="0.1"
                    min="0.1"
                    max="10"
                  />
                  <small style={styles.help}>1 = recommended, &gt;1 = heavier</small>
                </div>

                <div style={styles.field}>
                  <label style={styles.label} title="Recent sprays usually increase risk.">
                    {copy.daysSinceSprayLabel}
                  </label>
                  <input
                    type="number"
                    value={daysSinceSpray}
                    onChange={(e) => setDaysSinceSpray(clampNum(e.target.value, 0, 60))}
                    style={styles.input}
                    min="0"
                    max="60"
                  />
                </div>
              </div>

              <div style={styles.row2}>
                <div style={styles.field}>
                  <label style={styles.label} title={copy.halfLifeHelp}>
                    {copy.halfLifeLabel}
                  </label>
                  <input
                    type="number"
                    value={halfLifeDays}
                    onChange={(e) => setHalfLifeDays(clampNum(e.target.value, 0.1, 120))}
                    style={styles.input}
                    step="0.1"
                    min="0.1"
                    max="120"
                  />
                  <small style={styles.help}>{copy.halfLifeHelp}</small>
                </div>

                <div style={styles.field}>
                  <label style={styles.label} title="Soil moisture affects plant stress and residue persistence.">
                    Soil moisture (0–100)
                  </label>
                  <input
                    type="number"
                    value={soilMoisture}
                    onChange={(e) => setSoilMoisture(clampNum(e.target.value, 0, 100))}
                    style={styles.input}
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div style={styles.row2}>
                <div style={styles.field}>
                  <label style={styles.label} title="Optional. Leave as-is if unknown.">
                    Leaf pH
                  </label>
                  <input
                    type="number"
                    value={leafPh}
                    onChange={(e) => setLeafPh(clampNum(e.target.value, 3, 10))}
                    style={styles.input}
                    step="0.1"
                    min="3"
                    max="10"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label} title="Optional. Leave as-is if unknown.">
                    Soil pH
                  </label>
                  <input
                    type="number"
                    value={soilPh}
                    onChange={(e) => setSoilPh(clampNum(e.target.value, 3, 10))}
                    style={styles.input}
                    step="0.1"
                    min="3"
                    max="10"
                  />
                </div>
              </div>

              <div style={styles.cardSoft}>
                <div style={styles.cardSoftTitle}>Weather</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                  <button style={styles.secondaryBtn} onClick={useMyWeather} disabled={weatherLoading}>
                    {weatherLoading ? "Fetching..." : "Auto-fill from my location"}
                  </button>
                  {weatherStatus ? <span style={styles.smallMuted}>{weatherStatus}</span> : null}
                </div>

                <div style={styles.row3}>
                  <div style={styles.field}>
                    <label style={styles.label}>Temp (°C)</label>
                    <input type="number" value={tempC} onChange={(e) => setTempC(clampNum(e.target.value, -10, 55))} style={styles.input} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Humidity (%)</label>
                    <input type="number" value={humidity} onChange={(e) => setHumidity(clampNum(e.target.value, 0, 100))} style={styles.input} min="0" max="100" />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Rain last 24h (mm)</label>
                    <input type="number" value={rainMm24h} onChange={(e) => setRainMm24h(clampNum(e.target.value, 0, 500))} style={styles.input} min="0" max="500" />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={styles.disclaimerInline}>
                  <b>Note:</b> AI stress is a visual proxy (not lab testing). Always follow label instructions.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={styles.card}>
            <h2 style={styles.h2}>3) Analyze</h2>
            <p style={styles.p}>
              We’ll send the photo + inputs to <code>/api/scan</code> and render risk + breakdown.
            </p>

            <div style={styles.summaryGrid}>
              <div style={styles.summaryItem}><span style={styles.summaryKey}>Crop</span><span>{inputs.crop}</span></div>
              <div style={styles.summaryItem}><span style={styles.summaryKey}>Pesticide</span><span>{inputs.pesticide}</span></div>
              <div style={styles.summaryItem}><span style={styles.summaryKey}>Dose</span><span>{inputs.recommendedDose}</span></div>
              <div style={styles.summaryItem}><span style={styles.summaryKey}>Days since spray</span><span>{inputs.daysSinceSpray}</span></div>
              <div style={styles.summaryItem}><span style={styles.summaryKey}>Breakdown time</span><span>{inputs.halfLifeDays} days</span></div>
              <div style={styles.summaryItem}><span style={styles.summaryKey}>AI stress</span><span>{inputs.imageStress}/100</span></div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button style={styles.secondaryBtn} onClick={() => setStep(2)} disabled={loading}>Back</button>
              <button style={styles.primaryBtn} onClick={onAnalyze} disabled={loading}>
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>

            {loading ? (
              <div style={styles.loadingBox}>
                <div style={styles.loadingLine} />
                <div style={styles.loadingLine} />
                <div style={styles.loadingLine} />
              </div>
            ) : null}
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && result && (
          <div style={styles.card}>
            <h2 style={styles.h2}>4) Result</h2>

            <div style={styles.resultTop}>
              <div style={{ ...styles.bigNumber, ...stylesRisk.bigNumber(resultMeta.tone) }}>
                {result.riskPercent === null || Number.isNaN(result.riskPercent)
                  ? "—"
                  : `${Math.round(result.riskPercent)}%`}
              </div>
              <div>
                <div style={{ ...styles.levelPill, ...stylesRisk.levelPill(resultMeta.tone) }}>
                  {resultMeta.label}
                </div>
                <div style={styles.smallMuted}>Risk estimate + phytotoxicity likelihood</div>
              </div>
            </div>

            {/* Plain-English explanation */}
            <div style={styles.cardSoft}>
              <div style={styles.cardSoftTitle}>Why this result?</div>
              <div style={{ color: "rgba(15,61,42,0.88)", lineHeight: 1.55 }}>
                {plainReason}
              </div>
              <div style={{ marginTop: 10, ...styles.smallMuted }}>
                Disclaimer: AI score is a visual proxy. Always follow label instructions and safe waiting intervals.
              </div>
            </div>

            <div style={styles.grid2}>
              <div style={styles.cardSoft}>
                <div style={styles.cardSoftTitle}>Breakdown</div>
                {Object.keys(result.breakdown || {}).length === 0 ? (
                  <div style={styles.smallMuted}>No breakdown returned by the API.</div>
                ) : (
                  <div style={styles.breakdownList}>
                    {Object.entries(result.breakdown).map(([k, v]) => (
                      <div key={k} style={styles.breakRow}>
                        <span style={styles.breakKey}>{prettyLabel(k)}</span>
                        <span style={styles.breakVal}>
                          {typeof v === "number" ? v.toFixed(3) : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.cardSoft}>
                <div style={styles.cardSoftTitle}>Recommendations</div>
                {result.tips?.length ? (
                  <ul style={styles.ul}>
                    {result.tips.slice(0, 8).map((t, idx) => <li key={idx} style={styles.liFixed}>{t}</li>)}
                  </ul>
                ) : (
                  <div style={styles.smallMuted}>No tips returned.</div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button style={styles.secondaryBtn} onClick={() => setStep(2)}>Edit inputs</button>
                  <button style={styles.primaryBtn} onClick={resetAll}>New scan</button>
                </div>
              </div>
            </div>

            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer" }}>Debug (raw API response)</summary>
              <pre style={styles.pre}>{JSON.stringify(result.raw, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

const stylesRisk = {
  bigNumber: (tone) => {
    if (tone === "red") return { color: "rgba(239,68,68,0.92)" };
    if (tone === "amber") return { color: "rgba(234,179,8,0.92)" };
    if (tone === "green") return { color: "rgba(34,197,94,0.92)" };
    return { color: "rgba(15,61,42,0.92)" };
  },
  levelPill: (tone) => {
    if (tone === "red")
      return { border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.10)" };
    if (tone === "amber")
      return { border: "1px solid rgba(234,179,8,0.35)", background: "rgba(234,179,8,0.10)" };
    if (tone === "green")
      return { border: "1px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.10)" };
    return { border: "1px solid rgba(15,61,42,0.14)", background: "rgba(38,199,102,0.10)" };
  },
};

const styles = {
  // ✅ CHANGED: match the new global light agriculture theme (no dark background)
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
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  title: { margin: 0, fontSize: 28, letterSpacing: 0.2 },
  subTitle: { margin: "6px 0 0", color: "rgba(15,61,42,0.62)" },

  stepper: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
    marginBottom: 14,
  },
  step: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(15,61,42,0.10)",
    background: "rgba(255,255,255,0.70)",
    color: "rgba(15,61,42,0.72)",
  },
  stepActive: {
    border: "1px solid rgba(38,199,102,0.35)",
    background: "rgba(38,199,102,0.14)",
    color: "rgba(15,61,42,0.92)",
  },
  stepDone: { color: "rgba(15,61,42,0.85)" },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(38,199,102,0.16)",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(15,61,42,0.92)",
  },

  card: {
    border: "1px solid rgba(15,61,42,0.10)",
    background: "rgba(255,255,255,0.78)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
  },

  cardSoft: {
    border: "1px solid rgba(15,61,42,0.10)",
    background: "rgba(38,199,102,0.08)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },

  cardSoftTitle: { fontWeight: 900, marginBottom: 10 },

  h2: { margin: "0 0 8px", fontSize: 18 },
  p: { margin: "0 0 12px", color: "rgba(15,61,42,0.72)", lineHeight: 1.5 },

  file: {
    width: "100%",
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,255,255,0.78)",
    border: "1px solid rgba(15,61,42,0.10)",
  },

  hintBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    border: "1px dashed rgba(15,61,42,0.18)",
    background: "rgba(255,255,255,0.65)",
  },
  hintTitle: { fontWeight: 900, marginBottom: 6 },

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  row3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },

  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 },
  label: { fontSize: 12, color: "rgba(15,61,42,0.70)" },

  input: {
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(15,61,42,0.10)",
    color: "rgba(15,61,42,0.92)",
    outline: "none",
  },

  help: { color: "rgba(15,61,42,0.58)" },

  previewImg: {
    width: "100%",
    maxHeight: 360,
    objectFit: "cover",
    borderRadius: 14,
    border: "1px solid rgba(15,61,42,0.10)",
  },
  previewPlaceholder: {
    height: 240,
    borderRadius: 14,
    border: "1px dashed rgba(15,61,42,0.18)",
    display: "grid",
    placeItems: "center",
    color: "rgba(15,61,42,0.55)",
    background: "rgba(255,255,255,0.65)",
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
    background: "rgba(255,255,255,0.75)",
    color: "rgba(15,61,42,0.92)",
    cursor: "pointer",
    fontWeight: 800,
  },
  secondaryBtnSm: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(15,61,42,0.14)",
    background: "rgba(255,255,255,0.70)",
    color: "rgba(15,61,42,0.92)",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 12,
  },

  errorBanner: {
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.10)",
    color: "rgba(15,61,42,0.92)",
  },
  warnBanner: {
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(234,179,8,0.35)",
    background: "rgba(234,179,8,0.10)",
    color: "rgba(15,61,42,0.92)",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    marginTop: 10,
  },
  summaryItem: {
    border: "1px solid rgba(15,61,42,0.10)",
    background: "rgba(255,255,255,0.70)",
    borderRadius: 14,
    padding: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    color: "rgba(15,61,42,0.86)",
  },
  summaryKey: { color: "rgba(15,61,42,0.55)" },

  loadingBox: { marginTop: 14, display: "grid", gap: 10 },
  loadingLine: {
    height: 12,
    borderRadius: 999,
    background: "rgba(255,255,255,0.70)",
    border: "1px solid rgba(15,61,42,0.08)",
  },

  resultTop: { display: "flex", alignItems: "center", gap: 14, margin: "10px 0 14px" },
  bigNumber: { fontSize: 44, fontWeight: 900, letterSpacing: -0.5 },

  levelPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    marginBottom: 6,
    width: "fit-content",
    color: "rgba(15,61,42,0.92)",
  },

  smallMuted: { color: "rgba(15,61,42,0.60)", fontSize: 12 },

  breakdownList: { display: "grid", gap: 8 },
  breakRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(15,61,42,0.10)",
    background: "rgba(255,255,255,0.70)",
  },
  breakKey: { color: "rgba(15,61,42,0.70)" },
  breakVal: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    color: "rgba(15,61,42,0.90)",
    fontSize: 12,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15,61,42,0.14)",
    background: "rgba(255,255,255,0.75)",
    fontWeight: 900,
    color: "rgba(15,61,42,0.92)",
  },

  tag: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(38,199,102,0.25)",
    background: "rgba(38,199,102,0.10)",
    fontWeight: 800,
    color: "rgba(15,61,42,0.92)",
  },

  disclaimerInline: {
    border: "1px solid rgba(15,61,42,0.10)",
    background: "rgba(255,255,255,0.70)",
    borderRadius: 14,
    padding: "10px 12px",
    color: "rgba(15,61,42,0.70)",
    fontSize: 12,
  },

  // ✅ Numbering/line alignment helper for any list item text (prevents awkward wrapping)
  liFixed: { lineHeight: 1.6 },

  ul: { margin: "6px 0 0", paddingLeft: 18, color: "rgba(15,61,42,0.78)", lineHeight: 1.6 },

  pre: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(15,61,42,0.10)",
    overflow: "auto",
    color: "rgba(15,61,42,0.85)",
    fontSize: 12,
  },
};
