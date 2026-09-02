const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
  {
    interview: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    text: { type: String, required: true },
    category: { type: String },
    isFollowUp: { type: Boolean, default: false },
    source: { type: String, enum: ["bank", "resume", "generated", "follow_up"], default: "generated" },
    askedBy: { type: String },
    order: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", QuestionSchema);
