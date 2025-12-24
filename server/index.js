import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";

// ✅ ADD: mount auth routes
import authRoutes from "./auth/routes.js";

const app = express();

// ---------- Config ----------
const PORT = process.env.PORT || 5174;

// If frontend is on Vite (5173), CORS is needed for local dev.
// If you already handle proxying through Vite, CORS doesn't hurt.
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// For JSON endpoints (not multipart). Multipart is handled by multer.
app.use(express.json({ limit: "2mb" }));

// ---------- Multer (for multipart/form-data) ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB
  },
});

// ---------- Helpers ----------
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function riskLevelFromPercent(p) {
  if (!Number.isFinite(p)) return "—";
  if (p >= 70) return "High";
  if (p >= 35) return "Medium";
  return "Low";
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

/**
 * Very simple v1 placeholder scoring (so your Scan UI works end-to-end).
 * Replace later with your real formula from shared/risk.js.
 */
function computeRisk(inputs) {
  const recommendedDose = toNumber(inputs.recommendedDose);
  const daysSinceSpray = toNumber(inputs.daysSinceSpray);
  const halfLifeDays = toNumber(inputs.halfLifeDays);
  const leafPh = toNumber(inputs.leafPh);
  const soilPh = toNumber(inputs.soilPh);
  const soilMoisture = toNumber(inputs.soilMoisture);
  const imageStress = toNumber(inputs.imageStress);

  const tempC = toNumber(inputs?.weather?.tempC);
  const humidity = toNumber(inputs?.weather?.humidity);
  const rainMm24h = toNumber(inputs?.weather?.rainMm24h);

  // --- Component scores (0..1) ---
  // Dose score: 1 = normal (0.4), higher dose increases
  const doseScore = clamp01((recommendedDose - 1) / 3 + 0.4); // rough

  // Residue/decay score using half-life
  // residueFactor = exp(-ln(2)*days/halfLife), so more days => less risk
  let residueFactor = 0.6;
  if (Number.isFinite(daysSinceSpray) && Number.isFinite(halfLifeDays) && halfLifeDays > 0) {
    residueFactor = Math.exp(-Math.log(2) * (daysSinceSpray / halfLifeDays));
    residueFactor = clamp01(residueFactor);
  }

  // pH stress: farther from neutral-ish increases
  const leafPhScore = Number.isFinite(leafPh) ? clamp01(Math.abs(6.5 - leafPh) / 3) : 0.2;
  const soilPhScore = Number.isFinite(soilPh) ? clamp01(Math.abs(6.8 - soilPh) / 3) : 0.2;

  // moisture stress: too low or too high increases
  let moistureScore = 0.2;
  if (Number.isFinite(soilMoisture)) {
    const ideal = 55;
    moistureScore = clamp01(Math.abs(ideal - soilMoisture) / 55);
  }

  // weather stress: heat + humidity + rain (rough)
  let weatherScore = 0.2;
  if (Number.isFinite(tempC) || Number.isFinite(humidity) || Number.isFinite(rainMm24h)) {
    const t = Number.isFinite(tempC) ? clamp01((tempC - 25) / 15) : 0.2;
    const h = Number.isFinite(humidity) ? clamp01((humidity - 55) / 40) : 0.2;
    const r = Number.isFinite(rainMm24h) ? clamp01(rainMm24h / 80) : 0.0;
    weatherScore = clamp01(0.55 * t + 0.35 * h + 0.10 * r);
  }

  const imageStressScore = Number.isFinite(imageStress) ? clamp01(imageStress / 100) : 0.25;

  // --- Weighted risk (0..1) ---
  // (Adjust weights later in calibration)
  const risk01 =
    0.22 * doseScore +
    0.24 * residueFactor +
    0.14 * leafPhScore +
    0.10 * soilPhScore +
    0.10 * moistureScore +
    0.10 * weatherScore +
    0.10 * imageStressScore;

  const riskPercent = Math.round(clamp01(risk01) * 100);

  return {
    riskPercent,
    level: riskLevelFromPercent(riskPercent),
    breakdown: {
      doseScore,
      residueFactor,
      leafPhScore,
      soilPhScore,
      moistureScore,
      weatherScore,
      imageStressScore,
    },
    tips: buildTips({ riskPercent, doseScore, residueFactor, weatherScore, imageStressScore }),
  };
}

function buildTips({ riskPercent, doseScore, residueFactor, weatherScore, imageStressScore }) {
  const tips = [];

  if (riskPercent >= 70) tips.push("High risk detected: avoid immediate harvest and consider expert guidance.");
  if (riskPercent >= 35 && riskPercent < 70) tips.push("Moderate risk: monitor plant response and avoid over-application.");
  if (riskPercent < 35) tips.push("Low risk: continue monitoring and follow label instructions.");

  if (doseScore > 0.65) tips.push("Dose seems high relative to recommended. Reduce dose next spray if possible.");
  if (residueFactor > 0.65) tips.push("Recent spray detected. Risk may drop after a few more days.");
  if (weatherScore > 0.6) tips.push("Weather stress is high (heat/humidity/rain). Prefer spraying in cooler, calmer conditions.");
  if (imageStressScore > 0.6) tips.push("Leaf appears stressed. Avoid additional stress (over-spraying, midday spraying).");

  tips.push("Always follow label safety intervals and wear protection while spraying.");
  return tips.slice(0, 8);
}

// ---------- Routes ----------
app.get("/api/health", (req, res) => {
 res.json({ status: "ok", port: PORT });
});

// ✅ ADD: Auth routes mounted here
app.use("/api/auth", authRoutes);

/**
 * ✅ /api/scan
 * Expects multipart/form-data:
 * - image: File
 * - inputs: JSON string
 */
app.post("/api/scan", upload.single("image"), (req, res) => {
  try {
    // 1) Validate image exists
    if (!req.file) {
      return res.status(400).json({ error: "Leaf image is required." });
    }
    if (!req.file.mimetype?.startsWith("image/")) {
      return res.status(400).json({ error: "Invalid file type. Please upload an image." });
    }

    // 2) Parse inputs
    let inputs = req.body?.inputs;

    if (!inputs) {
      return res.status(400).json({ error: "inputs is required." });
    }

    if (typeof inputs === "string") {
      try {
        inputs = JSON.parse(inputs);
      } catch {
        return res.status(400).json({ error: "Invalid inputs JSON." });
      }
    }

    // 3) Validate recommendedDose
    const recommendedDose = toNumber(inputs?.recommendedDose);
    if (!(recommendedDose > 0)) {
      return res.status(400).json({
        error: "recommendedDose is required and must be > 0",
      });
    }

    // 4) Compute result (placeholder)
    const out = computeRisk(inputs);

    return res.json({
      ...out,
      meta: {
        received: {
          crop: inputs.crop,
          pesticide: inputs.pesticide,
          recommendedDose: inputs.recommendedDose,
        },
        file: { mimetype: req.file.mimetype, size: req.file.size },
      },
    });
  } catch (err) {
    console.error("SCAN ERROR:", err);
    return res.status(500).json({ error: "Server error while scanning." });
  }
});

// ✅ ADD: JSON error handler so frontend never gets HTML
app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR:", err);
  res.status(500).json({ error: "Server error." });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`✅ PestiScan backend running on http://localhost:${PORT}`);
  console.log(`✅ Health: http://localhost:${PORT}/api/health`);
});
