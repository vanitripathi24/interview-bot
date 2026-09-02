const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const Resume = require("../models/Resume");
const { parseResume } = require("../services/geminiService");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/upload", requireAuth, upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const { text: rawText } = await pdfParse(req.file.buffer);
    const parsed = await parseResume(rawText);

    const resume = await Resume.create({
      user: req.user.id,
      rawText,
      skills: parsed.skills || [],
      projects: parsed.projects || [],
      education: parsed.education || [],
      certifications: parsed.certifications || [],
      experience: parsed.experience || [],
      summary: parsed.summary || "",
    });

    res.status(201).json(resume);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);
    if (!resume) return res.status(404).json({ message: "Resume not found" });
    res.json(resume);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
