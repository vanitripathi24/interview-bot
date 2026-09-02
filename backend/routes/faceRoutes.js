const express = require("express");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

const MATCH_THRESHOLD = 0.6;

router.post("/register", requireAuth, async (req, res) => {
  try {
    const { descriptor, consent } = req.body;

    if (!consent) {
      return res.status(400).json({ message: "Explicit consent is required before storing biometric data." });
    }
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      return res.status(400).json({ message: "A valid 128-length face descriptor is required." });
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
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      return res.status(400).json({ message: "A valid 128-length face descriptor is required." });
    }

    const user = await User.findById(req.user.id).select("+faceDescriptor");
    if (!user || !user.faceDescriptor || user.faceDescriptor.length === 0) {
      return res.status(404).json({ message: "No registered face found for this account. Please register first." });
    }

    const distance = euclideanDistance(descriptor, user.faceDescriptor);
    const isMatch = distance < MATCH_THRESHOLD;

    res.json({ match: isMatch, distance: Number(distance.toFixed(3)) });
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
