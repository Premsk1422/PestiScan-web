// client/src/utils/leafVision.js
function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function getImageData(img, maxSide = 360) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return { data, w, h };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function laplacianVariance(gray, w, h) {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  const idx = (x, y) => y * w + x;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = gray[idx(x, y)];
      const n = gray[idx(x, y - 1)];
      const s = gray[idx(x, y + 1)];
      const e = gray[idx(x + 1, y)];
      const wv = gray[idx(x - 1, y)];

      const lap = 4 * c - (n + s + e + wv);
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / Math.max(1, count);
  const varr = sumSq / Math.max(1, count) - mean * mean;
  return varr;
}

export async function analyzeLeafPhoto(file, opts = {}) {
  const {
    minWidth = 480,
    minHeight = 480,
    maxFileMB = 8,
    minLeafCoverage = 0.18,
    minDetail = 35,
    maxAspect = 2.3,
  } = opts;

  const reasons = [];

  if (!file?.type?.startsWith("image/")) reasons.push("Please upload a real photo (JPG/PNG/WebP).");
  if (file?.size > maxFileMB * 1024 * 1024) reasons.push(`Image too large (max ${maxFileMB}MB).`);

  let img;
  try {
    img = await loadImageFromFile(file);
  } catch {
    return { ok: false, reasons: ["Could not read image. Try another photo."], metrics: {}, imageStress: 50, symptoms: [] };
  }

  if (img.width < minWidth || img.height < minHeight) reasons.push(`Image too small. Use at least ${minWidth}×${minHeight}.`);
  const aspect = img.width / img.height;
  if (aspect > maxAspect || aspect < 1 / maxAspect) reasons.push("Weird aspect ratio. Avoid screenshots/collages.");

  const { data, w, h } = getImageData(img, 360);
  const gray = new Float32Array(w * h);

  let leafLike = 0;
  let green = 0;
  let yellow = 0;
  let brown = 0;
  let darkSpot = 0;
  let satLowCount = 0;

  let edgeBrown = 0;
  let edgeTotal = 0;
  const edgeBand = Math.max(2, Math.round(Math.min(w, h) * 0.10));

  const total = w * h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];

      const gr = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      gray[y * w + x] = gr;

      const { h: hh, s, v } = rgbToHsv(r, g, b);

      if (s < 0.08) satLowCount++;

      const isLeafLike = (hh >= 55 && hh <= 170) && s > 0.18 && v > 0.12;
      if (isLeafLike) leafLike++;

      const isGreen = (hh >= 70 && hh <= 160) && s > 0.22 && v > 0.14;
      if (isGreen) green++;

      const isYellow = (hh >= 35 && hh < 70) && s > 0.18 && v > 0.18;
      if (isYellow) yellow++;

      const isBrown = ((hh >= 10 && hh < 35) || (hh >= 0 && hh < 10)) && s > 0.16 && v > 0.10;
      if (isBrown) brown++;

      const isDark = v < 0.22 && s > 0.12;
      if (isLeafLike && isDark) darkSpot++;

      const isEdge = x < edgeBand || y < edgeBand || x >= w - edgeBand || y >= h - edgeBand;
      if (isEdge) {
        edgeTotal++;
        if (isBrown) edgeBrown++;
      }
    }
  }

  const leafCoverage = leafLike / Math.max(1, total);
  const greenRatio = green / Math.max(1, total);
  const yellowRatio = yellow / Math.max(1, total);
  const brownRatio = brown / Math.max(1, total);
  const darkSpotRatio = darkSpot / Math.max(1, total);
  const edgeBurnRatio = edgeBrown / Math.max(1, edgeTotal);
  const satLowRatio = satLowCount / Math.max(1, total);

  const detail = laplacianVariance(gray, w, h);

  if (leafCoverage < minLeafCoverage) reasons.push("Leaf not clearly visible. Move closer and fill the frame with the leaf.");
  if (detail < minDetail) reasons.push("Photo looks too blurry. Hold steady and use better lighting.");
  if (satLowRatio > 0.65) reasons.push("Photo looks like a screenshot/graphic. Upload a real leaf photo.");

  const ok = reasons.length === 0;

  let stress01 =
    1.8 * yellowRatio +
    2.2 * brownRatio +
    1.6 * darkSpotRatio +
    1.8 * edgeBurnRatio -
    0.8 * greenRatio;

  stress01 = clamp(stress01, 0, 1);
  if (detail < minDetail * 1.6) stress01 = clamp(stress01 + 0.08, 0, 1);

  const imageStress = Math.round(stress01 * 100);

  const symptoms = [];
  if (yellowRatio > 0.08) symptoms.push("Yellowing (chlorosis)");
  if (brownRatio > 0.05) symptoms.push("Browning / necrosis");
  if (edgeBurnRatio > 0.08) symptoms.push("Edge burn");
  if (darkSpotRatio > 0.03) symptoms.push("Spots / lesions");
  if (greenRatio > 0.20 && symptoms.length === 0) symptoms.push("Mostly healthy green");

  return {
    ok,
    reasons,
    metrics: {
      w, h,
      aspect,
      fileMB: (file.size / (1024 * 1024)).toFixed(2),
      leafCoverage: Number(leafCoverage.toFixed(3)),
      greenRatio: Number(greenRatio.toFixed(3)),
      yellowRatio: Number(yellowRatio.toFixed(3)),
      brownRatio: Number(brownRatio.toFixed(3)),
      darkSpotRatio: Number(darkSpotRatio.toFixed(3)),
      edgeBurnRatio: Number(edgeBurnRatio.toFixed(3)),
      satLowRatio: Number(satLowRatio.toFixed(3)),
      detail: Number(detail.toFixed(1)),
    },
    imageStress,
    symptoms,
  };
}
