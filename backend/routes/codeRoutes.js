const express = require("express");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const LANGUAGE_IDS = {
  javascript: 63,
  python: 71,
  java: 62,
  cpp: 54,
};

router.post("/run", requireAuth, async (req, res) => {
  try {
    const { code, language, stdin } = req.body;
    const languageId = LANGUAGE_IDS[language];

    if (!code || !languageId) {
      return res.status(400).json({
        message: `code is required and language must be one of: ${Object.keys(LANGUAGE_IDS).join(", ")}`,
      });
    }

    const response = await fetch(
      "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-RapidAPI-Key": process.env.JUDGE0_API_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
        body: JSON.stringify({ source_code: code, language_id: languageId, stdin: stdin || "" }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Judge0 API error (${response.status}): ${text}`);
    }

    const result = await response.json();

    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      compileOutput: result.compile_output,
      status: result.status?.description,
      time: result.time,
      memory: result.memory,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
