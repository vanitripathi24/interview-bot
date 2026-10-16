const express = require("express");
const Interview = require("../models/Interview");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const WARNING_THRESHOLD = 4;

router.post("/:id/warning", requireAuth, async (req, res) => {
  try {
    const { type } = req.body;
    const validTypes = [
      "no_face",
      "multiple_faces",
      "identity_mismatch",
      "fullscreen_exit",
      "tab_switch",
      "copy_paste",
      "right_click",
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: `type must be one of: ${validTypes.join(", ")}` });
    }

    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });

    interview.proctoringWarnings.push({ type, timestamp: new Date() });
    if (interview.proctoringWarnings.length > WARNING_THRESHOLD) {
      interview.flagged = true;
    }
    await interview.save();

    res.status(201).json({
      warningsCount: interview.proctoringWarnings.length,
      flagged: interview.flagged,
      threshold: WARNING_THRESHOLD,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
