const express = require("express");
const Interview = require("../models/Interview");
const Question = require("../models/Question");
const Response = require("../models/Response");
const Report = require("../models/Report");
const Resume = require("../models/Resume");
const { requireAuth } = require("../middleware/auth");
const { retrieveQuestions } = require("../services/ragService");
const {
  generateQuestion,
  evaluateAnswer,
  generateReport,
  generateCareerRoadmap,
} = require("../services/geminiService");
const { streamReportPDF } = require("../services/pdfService");

const router = express.Router();

// POST /api/interviews/start
router.post("/start", requireAuth, async (req, res) => {
  try {
    const {
      interviewType,
      jobRole,
      experienceLevel,
      questionCount,
      resumeId,
      jobDescription,
      targetCompany,
      panelMode,
      timePerQuestion,
      questionMode,
    } = req.body;
    if (!interviewType || !jobRole || !experienceLevel) {
      return res.status(400).json({ message: "interviewType, jobRole, and experienceLevel are required" });
    }

    // Both question modes are free for every account. "static" pulls from
    // the curated question bank; "dynamic" skips the bank and asks the LLM
    // to generate a fresh, non-repeating question every time — see
    // geminiService.js generateQuestion() and the previouslyAsked dedup
    // below for how repeats are avoided.
    const requestedMode = questionMode === "dynamic" ? "dynamic" : "static";

    const interview = await Interview.create({
      user: req.user.id,
      resume: resumeId || undefined,
      interviewType,
      jobRole,
      experienceLevel,
      questionCount: questionCount || 5,
      jobDescription: jobDescription || undefined,
      targetCompany: targetCompany || undefined,
      panelMode: !!panelMode,
      timePerQuestion: timePerQuestion || 0,
      questionMode: requestedMode,
      status: "in_progress",
    });

    res.status(201).json(interview);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/interviews/:id — fetch a single interview's config (used by the
// frontend to know panelMode/timePerQuestion/targetCompany/questionMode).
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    res.json(interview);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/interviews/:id/next-question
// Runs the Interview Agent. In "static" mode, it retrieves candidates from
// the curated question bank (RAG-style) and picks/adapts/follows up from
// those. In "dynamic" mode, it skips the bank entirely and asks the LLM to
// generate a fresh question from scratch every time, for maximum variety.
router.get("/:id/next-question", requireAuth, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });

    if (interview.currentQuestionIndex >= interview.questionCount) {
      return res.status(400).json({ message: "Interview already has all questions asked. Submit for report." });
    }

    const priorQuestions = await Question.find({ interview: interview._id }).sort({ order: 1 });
    const priorResponses = await Response.find({ interview: interview._id }).populate("question");

    const history = priorResponses.map((r) => ({
      question: r.question.text,
      answer: r.answerText,
    }));

    let skills = [];
    if (interview.resume) {
      const resume = await Resume.findById(interview.resume);
      if (resume) skills = resume.skills;
    }

    // Static mode retrieves from the curated bank; dynamic mode intentionally
    // skips retrieval so the LLM isn't anchored to a fixed set of questions.
    const retrieved =
      interview.questionMode === "static"
        ? retrieveQuestions({
            jobRole: interview.jobRole,
            interviewType: interview.interviewType,
            skills,
            limit: 5,
          })
        : [];

    const resumeSummaryDoc = interview.resume ? await Resume.findById(interview.resume) : null;

    // Dynamic mode's "no repeats" guarantee spans more than just this one
    // session: we also pull the text of every dynamic-mode question this
    // user has already been asked for this same role, across their past
    // interviews, and tell the LLM to avoid all of them too — not just the
    // ones asked earlier in the current conversation.
    let previouslyAsked = [];
    if (interview.questionMode === "dynamic") {
      const pastInterviewIds = await Interview.find({
        user: req.user.id,
        jobRole: interview.jobRole,
        questionMode: "dynamic",
      }).distinct("_id");
      // Cap how many we send back to the LLM so the prompt doesn't grow
      // unbounded for a candidate who has taken many dynamic interviews —
      // the most recent ones are the most likely to still feel repetitive.
      const pastQuestions = await Question.find({ interview: { $in: pastInterviewIds } })
        .sort({ createdAt: -1 })
        .limit(60)
        .select("text");
      previouslyAsked = pastQuestions.map((q) => q.text);
    }

    const generated = await generateQuestion({
      jobRole: interview.jobRole,
      experienceLevel: interview.experienceLevel,
      interviewType: interview.interviewType,
      resumeSummary: resumeSummaryDoc ? resumeSummaryDoc.summary : "",
      jobDescription: interview.jobDescription,
      targetCompany: interview.targetCompany,
      panelMode: interview.panelMode,
      questionMode: interview.questionMode,
      history,
      retrievedQuestions: retrieved,
      previouslyAsked,
    });

    const question = await Question.create({
      interview: interview._id,
      text: generated.text,
      category: generated.category,
      isFollowUp: !!generated.isFollowUp,
      source: generated.isFollowUp ? "follow_up" : interview.questionMode === "dynamic" ? "generated" : retrieved.length ? "bank" : "generated",
      askedBy: generated.askedBy || undefined,
      order: priorQuestions.length + 1,
    });

    res.json(question);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/interviews/:id/answer
router.post("/:id/answer", requireAuth, async (req, res) => {
  try {
    const { questionId, answerText } = req.body;
    if (!answerText || !answerText.trim()) {
      return res.status(400).json({ message: "answerText is required before moving on" });
    }

    const interview = await Interview.findById(req.params.id);
    const question = await Question.findById(questionId);
    if (!interview || !question) return res.status(404).json({ message: "Interview or question not found" });

    const evaluation = await evaluateAnswer({
      question: question.text,
      answer: answerText,
      jobRole: interview.jobRole,
      experienceLevel: interview.experienceLevel,
      interviewType: interview.interviewType,
    });

    const response = await Response.create({
      interview: interview._id,
      question: question._id,
      answerText,
      evaluation,
    });

    interview.currentQuestionIndex += 1;
    if (interview.currentQuestionIndex >= interview.questionCount) {
      interview.status = "completed";
    }
    await interview.save();

    res.status(201).json({ response, interviewStatus: interview.status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/interviews/:id/report
router.get("/:id/report", requireAuth, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });

    let report = await Report.findOne({ interview: interview._id });
    if (report) return res.json(report);

    if (interview.status !== "completed") {
      return res.status(400).json({ message: "Interview is not completed yet" });
    }

    const responses = await Response.find({ interview: interview._id }).populate("question");

    const reportData = await generateReport({
      responses,
      jobRole: interview.jobRole,
      interviewType: interview.interviewType,
    });

    const weakAreas = reportData.weaknesses || [];
    const roadmap = await generateCareerRoadmap({
      weakAreas,
      targetRole: interview.jobRole,
      currentStrengths: reportData.strengths || [],
    });

    const careerRoadmapText = [
      roadmap.intro,
      ...(roadmap.roadmap || []).map((m) => `${m.month}: ${m.topics.join(", ")}`),
    ].join("\n");

    report = await Report.create({
      interview: interview._id,
      overallScore: reportData.overallScore,
      sectionScores: reportData.sectionScores,
      strengths: reportData.strengths,
      weaknesses: reportData.weaknesses,
      learningTopics: reportData.learningTopics,
      careerRoadmap: careerRoadmapText,
      recommendation: reportData.recommendation,
      proctoringFlagged: interview.flagged,
      proctoringWarningsCount: interview.proctoringWarnings.length,
    });

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/interviews/:id/report/pdf
router.get("/:id/report/pdf", requireAuth, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    const report = await Report.findOne({ interview: req.params.id });
    if (!interview || !report) return res.status(404).json({ message: "Report not found" });

    const resume = interview.resume ? await Resume.findById(interview.resume) : null;

    streamReportPDF(res, {
      candidateName: req.user.name || "Candidate",
      jobRole: interview.jobRole,
      interviewType: interview.interviewType,
      experienceLevel: interview.experienceLevel,
      resumeSummary: resume ? resume.summary : null,
      report,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
