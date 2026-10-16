const PDFDocument = require("pdfkit");

function streamReportPDF(res, data) {
  const { candidateName, jobRole, interviewType, experienceLevel, report, resumeSummary } = data;

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=interview-report.pdf`);
  doc.pipe(res);

  doc.fontSize(20).text("Interview Report", { align: "center" });
  doc.moveDown();

  doc.fontSize(12).text(`Candidate: ${candidateName}`);
  doc.text(`Role: ${jobRole}`);
  doc.text(`Interview Type: ${interviewType}`);
  doc.text(`Experience Level: ${experienceLevel}`);
  if (resumeSummary) doc.text(`Resume Summary: ${resumeSummary}`);
  doc.moveDown();

  doc.fontSize(16).text("Overall Score", { underline: true });
  doc.fontSize(12).text(`${report.overallScore}/10`);
  doc.moveDown();

  doc.fontSize(16).text("Section-wise Scores", { underline: true });
  Object.entries(report.sectionScores || {}).forEach(([section, score]) => {
    doc.fontSize(12).text(`${section}: ${score}/10`);
  });
  doc.moveDown();

  doc.fontSize(16).text("Strengths", { underline: true });
  (report.strengths || []).forEach((s) => doc.fontSize(12).text(`- ${s}`));
  doc.moveDown();

  doc.fontSize(16).text("Weaknesses", { underline: true });
  (report.weaknesses || []).forEach((w) => doc.fontSize(12).text(`- ${w}`));
  doc.moveDown();

  doc.fontSize(16).text("Recommended Learning Topics", { underline: true });
  (report.learningTopics || []).forEach((t) => doc.fontSize(12).text(`- ${t}`));
  doc.moveDown();

  if (report.careerRoadmap) {
    doc.fontSize(16).text("Career Roadmap", { underline: true });
    doc.fontSize(12).text(report.careerRoadmap);
    doc.moveDown();
  }

  doc.fontSize(16).text("Hiring Recommendation", { underline: true });
  doc.fontSize(14).text(report.recommendation || "Not available");

  if (report.proctoringFlagged) {
    doc.moveDown();
    doc.fontSize(16).fillColor("red").text("⚠ Proctoring Flag", { underline: true });
    doc.fontSize(12).fillColor("black").text(
      `This session was flagged during proctoring (${report.proctoringWarningsCount} warning(s) logged — face presence/identity checks and/or exam-integrity checks such as fullscreen exits, tab switches, copy/paste, or right-click attempts).`
    );
  }

  doc.end();
}

module.exports = { streamReportPDF };
