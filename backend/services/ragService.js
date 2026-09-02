/**
 * ragService.js
 *
 * Local "retrieval" over a JSON question bank, filtered by job role /
 * interview type, with simple keyword overlap scoring against resume
 * skills. Only used for STATIC-mode interviews — dynamic mode skips this
 * entirely and asks the LLM to generate fresh, non-repeating questions
 * unconstrained by any fixed bank (see interviewRoutes.js).
 *
 * UPGRADE PATH TO REAL RAG (ChromaDB):
 *   1. npm install chromadb
 *   2. On server startup, embed each question in questionBank.json and
 *      upsert into a Chroma collection, storing jobRoles/interviewType/
 *      category as metadata.
 *   3. Replace retrieveQuestions() below with a similarity query against
 *      that collection.
 *   4. Everything downstream is unchanged — it just receives a different
 *      (better) list of candidate questions.
 */

const fs = require("fs");
const path = require("path");

const bankPath = path.join(__dirname, "..", "data", "questionBank.json");
const questionBank = JSON.parse(fs.readFileSync(bankPath, "utf-8"));

function retrieveQuestions({ jobRole, interviewType, skills = [], limit = 5 }) {
  const skillsLower = skills.map((s) => s.toLowerCase());

  const scored = questionBank
    .filter((q) => q.interviewType === interviewType && q.jobRoles.includes(jobRole))
    .map((q) => {
      const categoryMatch = skillsLower.some((s) => q.category.toLowerCase().includes(s) || s.includes(q.category.toLowerCase()));
      return { ...q, _score: categoryMatch ? 1 : 0 };
    })
    .sort((a, b) => b._score - a._score);

  return scored.slice(0, limit).map(({ text, category }) => ({ text, category }));
}

module.exports = { retrieveQuestions };
