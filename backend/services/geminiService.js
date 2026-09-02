/**
 * geminiService.js
 *
 * NOTE: despite the filename, this now calls Groq (not Gemini) — kept the
 * filename to avoid touching every route that imports it. Groq's free tier
 * gives far more daily requests than Gemini's, which is why we switched.
 *
 * Agents implemented here:
 *   1. Resume Agent      -> parseResume()
 *   2. Interview Agent   -> generateQuestion()
 *   3. Technical + Communication Evaluator Agents -> evaluateAnswer()
 *   4. Report Agent       -> generateReport()
 *   5. Career Coach Agent -> generateCareerRoadmap()
 */

const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
const MODEL = "openai/gpt-oss-120b";

function safeParseJSON(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse model output as JSON:\n", cleaned);
    throw new Error("Model did not return valid JSON. Raw output logged above.");
  }
}

async function callGemini(prompt, { temperature } = {}) {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    ...(temperature !== undefined ? { temperature } : {}),
  });
  const text = completion.choices[0].message.content;
  return safeParseJSON(text);
}

// ---------------------------------------------------------------------------
// 1. Resume Agent
// ---------------------------------------------------------------------------
async function parseResume(rawText) {
  const prompt = `
You are a resume-parsing agent. Read the resume text below and extract structured
information. Respond with ONLY valid JSON, no preamble, no markdown fences, matching
exactly this schema:

{
  "skills": ["string", ...],
  "projects": ["short description string", ...],
  "education": ["string", ...],
  "certifications": ["string", ...],
  "experience": ["short description string", ...],
  "summary": "One or two sentences on the candidate's strongest and weakest areas, e.g. 'Strong in React and REST APIs; limited exposure to system design and databases.'"
}

Resume text:
"""
${rawText}
"""
`;
  return callGemini(prompt);
}

// ---------------------------------------------------------------------------
// 2. Interview Agent (question generation + follow-ups)
// ---------------------------------------------------------------------------
const PANELISTS = [
  { name: "Priya Sharma", role: "HR Manager", style: "warm and conversational, focuses on culture fit, motivation, and communication clarity" },
  { name: "Arjun Mehta", role: "Senior Tech Lead", style: "direct and technically rigorous, pushes for depth, follows up hard on vague or hand-wavy answers" },
];

async function generateQuestion({
  jobRole,
  experienceLevel,
  interviewType,
  resumeSummary,
  jobDescription,
  targetCompany,
  panelMode,
  questionMode,
  history,
  retrievedQuestions,
  previouslyAsked = [],
}) {
  const historyText = history.length
    ? history.map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`).join("\n\n")
    : "(no questions asked yet — this is the first question)";

  const isDynamic = questionMode === "dynamic";

  const bankText = !isDynamic && retrievedQuestions.length
    ? retrievedQuestions.map((q) => `- [${q.category}] ${q.text}`).join("\n")
    : null;

  const priorAskedText =
    isDynamic && previouslyAsked.length
      ? `\nThis candidate has taken dynamic-mode interviews for this role before. Do NOT ask any of these questions again, and avoid close variations of them:\n${previouslyAsked
          .map((q) => `- ${q}`)
          .join("\n")}`
      : "";

  const dynamicLine = isDynamic
    ? `This candidate is on DYNAMIC question mode: do NOT reuse common or templated interview questions. Generate a genuinely fresh, specific question tailored to this exact role, experience level, resume, target company, and job description — vary the topic, angle, and phrasing from anything a generic question bank would contain, from every prior question in this conversation, and from every question listed below as already asked.${priorAskedText}`
    : "";

  const companyLine = targetCompany
    ? `Target company: ${targetCompany}. Lean toward the interview style, topics, and difficulty this company is known for (e.g. heavy DSA/algorithms for Google, leadership-principles-style behavioral questions for Amazon, systems-design depth for Meta). If you don't have strong signal on this company's style, fall back to solid general practice for the role.`
    : "";

  const jdLine = jobDescription
    ? `Job description provided by the candidate:\n"""\n${jobDescription}\n"""\nPrefer questions that probe skills/requirements actually mentioned in this job description over generic ones.`
    : "";

  const dsaLine =
    interviewType === "DSA"
      ? `This is a DSA (Data Structures & Algorithms) round. Ask a coding problem (not a conceptual definition question) — the candidate will respond with code or pseudocode, and you should expect them to discuss their approach and complexity.`
      : "";

  const currentPanelist = panelMode ? PANELISTS[history.length % PANELISTS.length] : null;
  const panelLine = currentPanelist
    ? `You are speaking AS ${currentPanelist.name}, a ${currentPanelist.role} on this interview panel. Your style: ${currentPanelist.style}. Write the question in a voice consistent with this persona.`
    : "";

  const prompt = `
You are the Interview Agent conducting a ${interviewType} interview for a
${experienceLevel} candidate applying for ${jobRole}.

${panelLine}
${companyLine}
${jdLine}
${dsaLine}
${dynamicLine}

Candidate resume summary: ${resumeSummary || "Not provided."}

Conversation so far:
${historyText}

${
  bankText
    ? `Candidate question bank retrieved for this role (you may pick one, adapt one, or write a natural follow-up to the candidate's last answer instead if that's more appropriate):\n${bankText}`
    : `No fixed question bank is being used for this question — generate an original question yourself, grounded in the role, experience level, resume, target company, and job description above.`
}

Decide the single best next question. If the last answer was shallow or mentioned
something worth probing, prefer a follow-up question over a fresh question.
Respond with ONLY valid JSON:

{
  "text": "the question to ask",
  "category": "short topic label, e.g. React, DBMS, HR, Behavioral, DSA",
  "isFollowUp": true or false
}
`;
  // Dynamic mode uses a higher temperature for more varied phrasing/topics
  // across candidates and sessions; static mode stays deterministic-ish
  // since it's mostly picking/adapting from a fixed bank.
  const result = await callGemini(prompt, { temperature: isDynamic ? 0.9 : 0.6 });
  return { ...result, askedBy: currentPanelist ? currentPanelist.name : null };
}

// ---------------------------------------------------------------------------
// 3. Evaluator Agents (Technical Accuracy + Communication, combined call)
// ---------------------------------------------------------------------------
async function evaluateAnswer({ question, answer, jobRole, experienceLevel, interviewType }) {
  const dsaNote =
    interviewType === "DSA"
      ? `This is a DSA round — the answer may be code or pseudocode. Judge "technicalAccuracy" on correctness of logic, "completeness" on whether edge cases and complexity (time/space) were addressed, not on syntax perfection.`
      : "";

  const prompt = `
You are two collaborating evaluator agents: a Technical Evaluator (checks technical
accuracy, relevance, completeness) and a Communication Evaluator (checks clarity,
confidence). Evaluate the candidate's answer below for a ${interviewType} interview,
role: ${jobRole}, experience level: ${experienceLevel}.
${dsaNote}

Question: ${question}
Candidate's answer: ${answer}

Score each dimension 1-10 (use 1-10, decimals allowed). If a dimension doesn't apply
(e.g. "confidence" for a pure HR question), still give your best-effort score rather
than omitting it. Respond with ONLY valid JSON:

{
  "technicalAccuracy": number,
  "communication": number,
  "relevance": number,
  "completeness": number,
  "confidence": number,
  "score": number,
  "strengths": ["short bullet", ...],
  "weaknesses": ["short bullet", ...],
  "explanation": "2-3 sentence justification of the score"
}
`;
  return callGemini(prompt);
}

// ---------------------------------------------------------------------------
// 4. Report Agent
// ---------------------------------------------------------------------------
async function generateReport({ responses, jobRole, interviewType }) {
  const transcript = responses
    .map(
      (r, i) =>
        `Q${i + 1} [${r.question.category}]: ${r.question.text}\nA${i + 1}: ${r.answerText}\nScore: ${r.evaluation.score}/10`
    )
    .join("\n\n");

  const prompt = `
You are the Report Agent. Summarize this completed ${interviewType} interview for
a ${jobRole} candidate into a final report. Base section scores on the categories
that actually appeared in the transcript (e.g. Technical, Communication, HR).

Transcript:
${transcript}

Respond with ONLY valid JSON:

{
  "overallScore": number,
  "sectionScores": { "SectionName": number, ... },
  "strengths": ["short bullet", ...],
  "weaknesses": ["short bullet", ...],
  "learningTopics": ["topic to study", ...],
  "recommendation": "Strong Hire" | "Hire" | "Hold" | "Reject"
}
`;
  return callGemini(prompt);
}

// ---------------------------------------------------------------------------
// 5. Career Coach Agent
// ---------------------------------------------------------------------------
async function generateCareerRoadmap({ weakAreas, targetRole, currentStrengths }) {
  const prompt = `
You are the Career Coach Agent. The candidate is aiming for a ${targetRole} role.

Current strengths: ${currentStrengths.join(", ") || "Not specified"}
Weak areas identified during the interview: ${weakAreas.join(", ") || "Not specified"}

Write a month-by-month learning roadmap (2-4 months) to close these gaps, plus a
one-sentence intro. Respond with ONLY valid JSON:

{
  "intro": "one sentence framing the roadmap",
  "roadmap": [
    { "month": "Month 1", "topics": ["topic", "topic"] },
    { "month": "Month 2", "topics": ["topic", "topic"] }
  ]
}
`;
  return callGemini(prompt);
}

module.exports = {
  parseResume,
  generateQuestion,
  evaluateAnswer,
  generateReport,
  generateCareerRoadmap,
};
