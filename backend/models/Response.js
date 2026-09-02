const mongoose = require("mongoose");

const EvaluationSchema = new mongoose.Schema(
  {
    technicalAccuracy: { type: Number, min: 0, max: 10 },
    communication: { type: Number, min: 0, max: 10 },
    relevance: { type: Number, min: 0, max: 10 },
    completeness: { type: Number, min: 0, max: 10 },
    confidence: { type: Number, min: 0, max: 10 },
    score: { type: Number, min: 0, max: 10 },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    explanation: { type: String },
  },
  { _id: false }
);

const ResponseSchema = new mongoose.Schema(
  {
    interview: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
    answerText: { type: String, required: true },
    evaluation: EvaluationSchema,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Response", ResponseSchema);
