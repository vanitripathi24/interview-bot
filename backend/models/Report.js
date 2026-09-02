const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema(
  {
    interview: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true, unique: true },
    overallScore: { type: Number },
    sectionScores: { type: Map, of: Number },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    learningTopics: [{ type: String }],
    careerRoadmap: { type: String },
    recommendation: {
      type: String,
      enum: ["Strong Hire", "Hire", "Hold", "Reject"],
    },
    proctoringFlagged: { type: Boolean, default: false },
    proctoringWarningsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", ReportSchema);
