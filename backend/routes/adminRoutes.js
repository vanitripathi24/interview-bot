const express = require("express");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const Report = require("../models/Report");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get("/users", async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
});

router.get("/reports", async (req, res) => {
  const reports = await Report.find().populate({
    path: "interview",
    populate: { path: "user", select: "name email" },
  });
  res.json(reports);
});

router.get("/question-categories", (req, res) => {
  const bankPath = path.join(__dirname, "..", "data", "questionBank.json");
  const bank = JSON.parse(fs.readFileSync(bankPath, "utf-8"));
  const categories = [...new Set(bank.map((q) => q.category))];
  res.json(categories);
});

router.post("/question-bank", (req, res) => {
  const { text, category, jobRoles, interviewType } = req.body;
  if (!text || !category || !jobRoles || !interviewType) {
    return res.status(400).json({ message: "text, category, jobRoles, and interviewType are required" });
  }
  const bankPath = path.join(__dirname, "..", "data", "questionBank.json");
  const bank = JSON.parse(fs.readFileSync(bankPath, "utf-8"));
  bank.push({ text, category, jobRoles, interviewType });
  fs.writeFileSync(bankPath, JSON.stringify(bank, null, 2));
  res.status(201).json({ message: "Question added", total: bank.length });
});

module.exports = router;
