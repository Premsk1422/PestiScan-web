import express from "express";
import { calculatePhytotoxicRisk } from "../../shared/risk.js";

const router = express.Router();

// POST /api/scan
router.post("/", (req, res) => {
  try {
    const payload = req.body || {};

    if (!payload.recommendedDose || Number(payload.recommendedDose) <= 0) {
      return res.status(400).json({
        error: "recommendedDose is required and must be > 0",
      });
    }

    const result = calculatePhytotoxicRisk(payload);
    return res.json(result);
  } catch (err) {
    console.error("Scan error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
