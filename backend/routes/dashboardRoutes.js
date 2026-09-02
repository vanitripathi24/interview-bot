const express = require("express");
const Interview = require("../models/Interview");
const Report = require("../models/Report");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/interviews", requireAuth, async (req, res) => {
  try {
    const interviews = await Interview.find({ user: req.user.id }).sort({ createdAt: -1 });
    const withReports = await Promise.all(
      interviews.map(async (interview) => {
        const report = await Report.findOne({ interview: interview._id });
        return { interview, report };
      })
    );
    res.json(withReports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const interviews = await Interview.find({ user: req.user.id });
    const reports = await Report.find({ interview: { $in: interviews.map((i) => i._id) } }).sort({ createdAt: 1 });

    const totalInterviews = interviews.length;
    const averageScore = reports.length
      ? reports.reduce((sum, r) => sum + (r.overallScore || 0), 0) / reports.length
      : 0;

    const trend = reports.map((r) => ({ date: r.createdAt, score: r.overallScore }));

    res.json({ totalInterviews, averageScore: Number(averageScore.toFixed(2)), trend });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
