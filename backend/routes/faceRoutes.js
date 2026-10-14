const express = require("express");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const DESCRIPTOR_LENGTH = 1024;

// Mirrors @vladmandic/human's match.ts similarity calculation (the
// frontend's face library) so a stored embedding can be compared here
// without pulling the whole model stack into the backend.
const MINKOWSKI_ORDER = 2;
const DISTANCE_MULTIPLIER = 25;
const SIMILARITY_MIN = 0.2;
const SIMILARITY_MAX = 0.8;
const MATCH_THRESHOLD = 0.5;

function similarity(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]) ** MINKOWSKI_ORDER;
  }
  const distance = Math.round(100 * DISTANCE_MULTIPLIER * sum) / 100;
  const root = distance ** (1 / MINKOWSKI_ORDER);
  const normalized = (1 - root / 100 - SIMILARITY_MIN) / (SIMILARITY_MAX - SIMILARITY_MIN);
  return Math.max(Math.min(normalized, 1), 0);
}

router.post("/register", requireAuth, async (req, res) => {
  try {
    const { descriptor, consent } = req.body;

    if (!consent) {
      return res.status(400).json({ message: "Explicit consent is required before storing biometric data." });
    }
    if (!Array.isArray(descriptor) || descriptor.length !== DESCRIPTOR_LENGTH) {
      return res.status(400).json({ message: `A valid ${DESCRIPTOR_LENGTH}-length face descriptor is required.` });
    }

    await User.findByIdAndUpdate(req.user.id, {
      faceDescriptor: descriptor,
      faceConsentGiven: true,
      faceConsentAt: new Date(),
    });

    res.status(201).json({ message: "Face registered successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/verify", requireAuth, async (req, res) => {
  try {
    const { descriptor } = req.body;
    if (!Array.isArray(descriptor) || descriptor.length !== DESCRIPTOR_LENGTH) {
      return res.status(400).json({ message: `A valid ${DESCRIPTOR_LENGTH}-length face descriptor is required.` });
    }

    const user = await User.findById(req.user.id).select("+faceDescriptor");
    if (!user || !user.faceDescriptor || user.faceDescriptor.length === 0) {
      return res.status(404).json({ message: "No registered face found for this account. Please register first." });
    }

    const score = similarity(descriptor, user.faceDescriptor);
    const isMatch = score >= MATCH_THRESHOLD;

    res.json({ match: isMatch, similarity: Number((score * 100).toFixed(1)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/status", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select("+faceDescriptor faceConsentGiven");
  res.json({
    registered: !!(user && user.faceDescriptor && user.faceDescriptor.length > 0),
    consentGiven: !!(user && user.faceConsentGiven),
  });
});

router.delete("/", requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $unset: { faceDescriptor: 1 },
      faceConsentGiven: false,
    });
    res.json({ message: "Face data deleted." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
