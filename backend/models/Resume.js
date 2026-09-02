const mongoose = require("mongoose");

const ResumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rawText: { type: String },
    skills: [{ type: String }],
    projects: [{ type: String }],
    education: [{ type: String }],
    certifications: [{ type: String }],
    experience: [{ type: String }],
    summary: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", ResumeSchema);
