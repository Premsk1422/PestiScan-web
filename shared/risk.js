// shared/risk.js
// PestiScan Web v1.0 — Risk scoring (heuristic)
// Includes AI stress tuning + confidence + sanity rules

function clamp(n, min = 0, max = 1) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(Math.max(x, min), max);
}

function clampNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function pct(x01) {
  return Math.round(clamp(x01, 0, 1) * 100);
}

function labelFromPercent(p) {
  const x = clampNum(p, 0);
  if (x <= 30) return "Low";
  if (x <= 60) return "Medium";
  return "High";
}

/**
 * Spray decay score (0..1) using half-life
 * residueFraction = exp(-ln(2) * days/halfLife)
 * Higher fraction -> higher risk
 */
function decayScore(daysSinceSpray, halfLifeDays) {
  const d = clampNum(daysSinceSpray, 0);
  const h = clampNum(halfLifeDays, 0);

  // If no half-life, assume moderate persistence (safe default)
  if (h <= 0) return clamp(0.5, 0, 1);

  const ln2 = Math.log(2);
  const fraction = Math.exp(-(ln2 * d) / h); // 1 -> fresh, 0 -> decayed
  return clamp(fraction, 0, 1);
}

/**
 * Dose score (0..1)
 * ratio = applied / recommended
 * Soft cap so dose doesn't dominate too hard.
 */
function doseScore(appliedDose, recommendedDose) {
  const applied = clampNum(appliedDose, 0);
  const rec = clampNum(recommendedDose, 0);

  if (rec <= 0) return 0; // no recommendation => don't force penalty

  const ratio = applied / rec;

  // curve:
  // <= 1.0 -> rises slowly
  // > 1.0 -> rises faster but still capped
  let s = 0;
  if (ratio <= 0) s = 0;
  else if (ratio <= 1) s = 0.15 + 0.55 * ratio; // up to 0.70
  else s = 0.70 + 0.30 * Math.tanh((ratio - 1) * 1.2); // approaches 1

  return clamp(s, 0, 1);
}

/**
 * pH penalty score (0..1) — mild influence in v1.0
 * Penalize extreme pH away from neutral.
 */
function phScore(leafPh, soilPh) {
  const lp = clampNum(leafPh, NaN);
  const sp = clampNum(soilPh, NaN);

  // If missing, return neutral impact
  if (!Number.isFinite(lp) && !Number.isFinite(sp)) return 0.25;

  // distance from 7, scaled
  const leafDist = Number.isFinite(lp) ? Math.min(Math.abs(lp - 7) / 3, 1) : 0.25;
  const soilDist = Number.isFinite(sp) ? Math.min(Math.abs(sp - 7) / 3, 1) : 0.25;

  // mild average
  return clamp(0.2 + 0.6 * (0.5 * leafDist + 0.5 * soilDist), 0, 1);
}

/**
 * Moisture score (0..1) — mild/moderate
 * Expect moisture 0..100.
 */
function moistureScore(moisture) {
  const m = clampNum(moisture, NaN);
  if (!Number.isFinite(m)) return 0.35;

  const x = clamp(m / 100, 0, 1);

  // Higher moisture can increase uptake/conditions; keep mild
  return clamp(0.25 + 0.55 * x, 0, 1);
}

/**
 * Weather score (0..1)
 * Inputs may include: tempC, humidity, rainfallMm, windKph
 * - high humidity + warmth increases risk a bit
 * - rainfall reduces residue risk slightly (wash-off)
 * - strong wind is small factor (spray drift / stress)
 */
function weatherScore(weather = {}) {
  const tempC = clampNum(weather.tempC ?? weather.temperatureC ?? weather.temperature, NaN);
  const humidity = clampNum(weather.humidity ?? weather.humidityPct, NaN);
  const rainfallMm = clampNum(weather.rainfallMm ?? weather.rainMm ?? weather.rain, NaN);
  const windKph = clampNum(weather.windKph ?? weather.windSpeedKph ?? weather.wind, NaN);

  let score = 0.35; // baseline

  if (Number.isFinite(tempC)) {
    // 18..35 is "active range"
    if (tempC >= 18 && tempC <= 35) score += 0.10;
    if (tempC > 35) score += 0.12;
    if (tempC < 12) score -= 0.06;
  }

  if (Number.isFinite(humidity)) {
    const h = clamp(humidity / 100, 0, 1);
    score += 0.18 * h; // humid -> slightly higher
  }

  if (Number.isFinite(rainfallMm)) {
    // rain washes residue: reduce some risk
    // 0..10mm -> small reduction, >10 -> stronger reduction
    const wash = Math.min(rainfallMm / 20, 1); // 0..1
    score -= 0.20 * wash;
  }

  if (Number.isFinite(windKph)) {
    const w = clamp(windKph / 35, 0, 1);
    score += 0.06 * w; // small effect
  }

  return clamp(score, 0, 1);
}

/**
 * ✅ NEW: AI contribution (0..0.25 max)
 * - softens stress score to reduce false highs
 * - multiplies by confidence
 * - reduces relevance when daysSinceSpray is high
 */
function computeAiContribution({ stressScore, confidence = 50, daysSinceSpray }) {
  if (stressScore == null) return 0;

  const stress = clamp(stressScore / 100, 0, 1);
  const conf = clamp(confidence / 100, 0.3, 1);

  // time decay: AI less relevant long after spray
  let timeFactor = 1;
  const d = clampNum(daysSinceSpray, 0);
  if (d >= 14) timeFactor = 0.4;
  else if (d >= 7) timeFactor = 0.65;

  // soften mid-range stress (avoid false alarms)
  const softenedStress =
    stress < 0.4 ? stress * 0.7 :
    stress < 0.7 ? stress * 0.85 :
    stress * 1.0;

  const aiScore = softenedStress * conf * timeFactor;

  // HARD CAP: AI <= 0.25 of total
  return Math.min(aiScore * 0.25, 0.25);
}

/**
 * Main API:
 * Pass in your merged payload: { inputs, weather, ai }
 * Returns: { riskPercent, level, breakdown, tips }
 */
export function calculateRisk(payload = {}) {
  const inputs = payload.inputs || payload || {};
  const weather = payload.weather || {};
  const ai = payload.ai || {};

  const appliedDose = inputs.appliedDose ?? inputs.dose ?? inputs.userDose;
  const recommendedDose = inputs.recommendedDose ?? inputs.recDose ?? inputs.recommended;
  const daysSinceSpray = inputs.daysSinceSpray ?? inputs.days ?? inputs.sprayDays;
  const halfLifeDays = inputs.halfLifeDays ?? inputs.halfLife ?? inputs.halflife;

  const leafPh = inputs.leafPh ?? inputs.leafPH;
  const soilPh = inputs.soilPh ?? inputs.soilPH;
  const moisture = inputs.moisture;

  const aiStress = ai.stressScore ?? ai.imageStress ?? inputs.imageStress; // legacy fallback
  const aiConfidence = ai.confidence ?? 50;

  // component scores (0..1)
  const sDose = doseScore(appliedDose, recommendedDose);
  const sDecay = decayScore(daysSinceSpray, halfLifeDays);
  const sPh = phScore(leafPh, soilPh);
  const sMoist = moistureScore(moisture);
  const sWeather = weatherScore(weather);

  // AI contribution is capped 0..0.25 directly (already weighted)
  const aiContribution = computeAiContribution({
    stressScore: aiStress,
    confidence: aiConfidence,
    daysSinceSpray,
  });

  /**
   * Weights (sum ~ 1.0, AI added separately but capped)
   * Keep AI from dominating.
   */
  const W_DOSE = 0.22;
  const W_DECAY = 0.28;
  const W_WEATHER = 0.18;
  const W_MOIST = 0.14;
  const W_PH = 0.10;

  // Base score (0..1), without AI
  let base =
    W_DOSE * sDose +
    W_DECAY * sDecay +
    W_WEATHER * sWeather +
    W_MOIST * sMoist +
    W_PH * sPh;

  base = clamp(base, 0, 1);

  // Add AI (already capped as <= 0.25)
  let total01 = clamp(base + aiContribution, 0, 1);

  // Convert to percent
  let riskPercent = pct(total01);

  /* ---------------- ✅ Sanity rules ---------------- */

  const d = clampNum(daysSinceSpray, 0);

  // Sanity 1: Long time since spray -> AI alone can't keep it very high
  if (d >= 20 && riskPercent > 60 && aiContribution > 0.15) {
    riskPercent = Math.min(riskPercent, 55);
  }

  // Sanity 2: Very low dose + strong decay => cannot be High
  // (doseScore low + decayScore low means little residue and little application)
  if (sDose < 0.2 && sDecay < 0.2) {
    riskPercent = Math.min(riskPercent, 45);
  }

  // Sanity 3: High AI stress but low confidence -> downgrade a bit
  if (clampNum(aiStress, 0) > 80 && clampNum(aiConfidence, 0) < 40) {
    riskPercent = Math.max(riskPercent - 10, 0);
  }

  const level = labelFromPercent(riskPercent);

  // breakdown in a stable schema
  const breakdown = {
    doseScore: sDose,
    decayScore: sDecay,
    weatherScore: sWeather,
    moistureScore: sMoist,
    phScore: sPh,
    aiContribution: aiContribution, // already weighted + capped
    baseScore: base,
    totalScore: clamp(riskPercent / 100, 0, 1),
  };

  const tips = [];

  // Tips (keep simple for v1.0)
  if (riskPercent >= 61) tips.push("High risk: follow label intervals and consider waiting before harvest.");
  if (d < 3) tips.push("Recent spray: residue is likely higher in the first few days.");
  if (Number.isFinite(recommendedDose) && Number.isFinite(appliedDose) && recommendedDose > 0) {
    const ratio = appliedDose / recommendedDose;
    if (ratio > 1.05) tips.push("Applied dose looks higher than recommended. Verify dilution and nozzle calibration.");
  }
  if (clampNum(weather.humidity, 0) >= 80) tips.push("High humidity can increase plant stress; confirm with field conditions.");
  if (aiStress != null && clampNum(aiStress, 0) >= 75) tips.push("Leaf stress detected: inspect for pests, disease, or nutrient stress too.");

  return {
    riskPercent,
    level,
    breakdown,
    tips,
  };
}

/**
 * Export for direct use if you want to call AI calc in UI too.
 */
export function computeAiScoreForDebug({ stressScore, confidence, daysSinceSpray }) {
  return computeAiContribution({ stressScore, confidence, daysSinceSpray });
}
