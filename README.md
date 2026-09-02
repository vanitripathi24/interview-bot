# AI Interview Copilot

Agentic AI interviewer + resume analyzer + career coach, with biometric
face-lock, live proctoring, real DSA code execution, panel interview mode,
and both a static curated question bank and dynamic AI-generated questions
— both fully free.

## Full feature list

- **Auth**: signup/login/guest, JWT-based
- **Resume analysis**: PDF upload → Resume Agent extracts skills/projects/education
- **30+ roles across technical AND non-technical categories** — Software &
  Engineering, Data & AI, Design, Product & Project Management, Business/
  Sales/Marketing, Operations/HR/Finance, plus a free-text "Other" option
- **Job description & target company matching** — paste a JD, pick a target
  company (Google, Amazon, Meta, etc.), and the Interview Agent leans toward
  that company's known style and the JD's specific requirements
- **Panel interview mode** — alternates between two interviewer personas
  (HR Manager / Senior Tech Lead)
- **DSA round with real code execution** — JavaScript/Python/Java/C++ run
  through Judge0 in a real sandbox, not just AI-judged text
- **Answer timer** — configurable per-question countdown with auto-submit
- **Speech-to-text & read-aloud** — browser-native, free, no API key
- **Biometric face-lock with liveness detection** — one-time registration
  (consent required, only a 128-number descriptor stored, never a photo);
  requires a detected blink before allowing capture, so a static photo or a
  phone held up to the camera can't be used to spoof it
- **Live proctoring with periodic identity re-verification** — checks face
  presence every 8s, and every ~48s re-verifies it's still the same
  registered person (not just that *a* face is present); flags a session
  after more than 4 warnings
- **Multi-agent evaluation & reporting** — technical accuracy, communication,
  relevance, completeness, confidence scoring; a Report Agent aggregates into
  a hiring recommendation; a Career Coach Agent writes a learning roadmap
- **Skill radar chart** on every report, plus PDF export
- **Recruiter dashboard** — admin-only, all candidates, sortable/filterable
- **Static vs. Dynamic question bank — both free**:
  - **Static** — curated question bank (`data/questionBank.json`)
  - **Dynamic** — fully LLM-generated questions every time, not constrained
    to any fixed set, with higher variety across every role; the backend
    also tracks every dynamic-mode question a candidate has already been
    asked for a given role (across all their past interviews, not just the
    current session) and instructs the model to avoid repeating any of
    them, so returning candidates keep getting fresh questions

## Setup

### Backend
```bash
cd backend
npm install
cp .env.example .env
# fill in MONGO_URI, JWT_SECRET, GROQ_API_KEY, JUDGE0_API_KEY
npm run dev
```

Getting each key (all free):
- **MongoDB**: free cluster at mongodb.com/cloud/atlas
- **Groq**: free API key at console.groq.com
- **Judge0**: free tier via RapidAPI — search "Judge0 CE"

### Frontend
```bash
cd frontend
npm install
npm start
```
Face-lock model weight files are already included in `frontend/public/models/`.
Speech-to-text and read-aloud work best in Chrome or Edge.

## How dynamic mode's no-repeat guarantee works (important if extending this)

1. `POST /api/interviews/start` accepts `questionMode: "static"` or
   `"dynamic"` from any logged-in user — there's no gating on either mode.
2. `GET /api/interviews/:id/next-question`, when the interview is in
   dynamic mode, looks up every other interview this same user has taken
   for the same `jobRole` with `questionMode: "dynamic"`, and pulls the
   text of every question asked in those (capped at the most recent 60).
3. That list is passed into `generateQuestion()` in `geminiService.js` as
   `previouslyAsked`, which is injected into the prompt with an explicit
   instruction not to repeat any of them or close variations — on top of
   the existing instruction not to repeat anything already asked earlier
   in the *current* conversation.

## Known limitations

- Web Speech API (STT/read-aloud) is Chrome/Edge only.
- Proctoring checks face presence, periodic identity match, and basic
  blink-based liveness — it doesn't attempt gaze-tracking, tab-switch
  detection, or video-replay detection (a recorded video of the registered
  person blinking would still pass).
- RAG retrieval (static mode) is keyword-based, not embedding-based; a
  ChromaDB upgrade path is documented in `ragService.js`.
- Dynamic mode's no-repeat check is prompt-based (it tells the LLM what to
  avoid) rather than a hard filter — it won't literally reject an output
  that slips through similar to a past question.
