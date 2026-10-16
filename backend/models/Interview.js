const mongoose = require("mongoose");

const InterviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    resume: { type: mongoose.Schema.Types.ObjectId, ref: "Resume" },
    interviewType: {
      type: String,
      enum: ["HR", "Technical", "Aptitude", "Behavioral", "DSA"],
      required: true,
    },
    jobRole: { type: String, required: true },
    // Free-text job description pasted by the candidate — lets the Interview
    // Agent tailor questions to specifics the role dropdown alone can't capture.
    jobDescription: { type: String },
    // Optional target company (e.g. "Google", "Amazon") — the Interview Agent
    // is prompted to lean toward that company's known interview style/topics.
    targetCompany: { type: String },
    // Panel mode: rotates between two interviewer personas (see PANELISTS in
    // geminiService.js) instead of a single generic interviewer voice.
    panelMode: { type: Boolean, default: false },
    // Seconds allowed per question; 0/undefined means no timer.
    timePerQuestion: { type: Number, default: 0 },
    // "static" = pulled/adapted from the curated question bank.
    // "dynamic" = fully LLM-generated each time, not constrained to the bank,
    // with broader variety and a cross-session no-repeat check (see
    // interviewRoutes.js /next-question and geminiService.js). Both modes
    // are free — this just controls where questions come from.
    questionMode: { type: String, enum: ["static", "dynamic"], default: "static" },
    experienceLevel: {
      type: String,
      enum: ["Fresher", "1-3 years", "3+ years"],
      required: true,
    },
    questionCount: { type: Number, default: 5 },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },
    currentQuestionIndex: { type: Number, default: 0 },
    proctoringWarnings: [
      {
        type: {
          type: String,
          enum: [
            "no_face",
            "multiple_faces",
            "identity_mismatch",
            "fullscreen_exit",
            "tab_switch",
            "copy_paste",
            "right_click",
          ],
        },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    flagged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Interview", InterviewSchema);
