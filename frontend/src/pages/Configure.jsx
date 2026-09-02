import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import Navbar from "../components/Navbar";

// Grouped so the dropdown stays scannable even with a much wider role list.
// Add more roles here any time — nothing else needs to change to support a
// new role name; the static bank falls back to generating fresh questions
// for roles it has no curated entries for, and dynamic mode handles any
// role equally well since it isn't bank-constrained at all.
const JOB_ROLE_GROUPS = [
  {
    label: "Software & Engineering",
    roles: [
      "Frontend Developer", "Backend Developer", "Full Stack Developer",
      "Mobile Developer (iOS/Android)", "DevOps Engineer", "Site Reliability Engineer",
      "QA / Test Engineer", "Cloud Engineer", "Cybersecurity Analyst",
      "Database Administrator", "Embedded Systems Engineer", "Game Developer",
      "Blockchain Developer",
    ],
  },
  {
    label: "Data & AI",
    roles: ["Data Analyst", "Data Scientist", "Data Engineer", "ML Engineer", "AI Engineer"],
  },
  {
    label: "Design",
    roles: ["UX Designer", "UI Designer", "Product Designer", "Graphic Designer"],
  },
  {
    label: "Product & Project Management",
    roles: ["Product Manager", "Project Manager", "Business Analyst", "Scrum Master"],
  },
  {
    label: "Business, Sales & Marketing",
    roles: [
      "Digital Marketing Specialist", "Sales Executive", "Business Development Manager",
      "Content Writer", "SEO Specialist", "Social Media Manager", "Brand Manager",
    ],
  },
  {
    label: "Operations, HR & Finance",
    roles: [
      "HR Manager / Recruiter", "Operations Manager", "Finance Analyst",
      "Accountant", "Customer Support Specialist", "Supply Chain Analyst",
    ],
  },
  {
    label: "Other",
    roles: ["Teacher / Trainer", "Consultant", "Other (type below)"],
  },
];

const INTERVIEW_TYPES = ["HR", "Technical", "Aptitude", "Behavioral", "DSA"];
const EXPERIENCE_LEVELS = ["Fresher", "1-3 years", "3+ years"];
const COMPANY_PRESETS = ["None / General", "Google", "Amazon", "Microsoft", "Meta", "Netflix", "Other"];

export default function Configure() {
  const [jobRole, setJobRole] = useState(JOB_ROLE_GROUPS[0].roles[0]);
  const [customRole, setCustomRole] = useState("");
  const [interviewType, setInterviewType] = useState(INTERVIEW_TYPES[1]);
  const [experienceLevel, setExperienceLevel] = useState(EXPERIENCE_LEVELS[0]);
  const [questionCount, setQuestionCount] = useState(5);
  const [jobDescription, setJobDescription] = useState("");
  const [companyPreset, setCompanyPreset] = useState(COMPANY_PRESETS[0]);
  const [customCompany, setCustomCompany] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [panelMode, setPanelMode] = useState(false);
  const [timePerQuestion, setTimePerQuestion] = useState(0);
  const [questionMode, setQuestionMode] = useState("static");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const resolvedCompany =
    companyPreset === "Other" ? customCompany.trim() : companyPreset === "None / General" ? "" : companyPreset;
  const resolvedRole = jobRole === "Other (type below)" ? customRole.trim() : jobRole;

  const handleQuestionModeChange = (mode) => {
    setQuestionMode(mode);
  };

  const handleStart = async () => {
    if (!resolvedRole) {
      setError("Please enter a job role.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      let resumeId;
      if (resumeFile) {
        const formData = new FormData();
        formData.append("resume", resumeFile);
        const { data: resume } = await api.post("/resume/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        resumeId = resume._id;
      }

      const { data: interview } = await api.post("/interviews/start", {
        jobRole: resolvedRole,
        interviewType,
        experienceLevel,
        questionCount: Number(questionCount),
        resumeId,
        jobDescription: jobDescription.trim() || undefined,
        targetCompany: resolvedCompany || undefined,
        panelMode,
        timePerQuestion: Number(timePerQuestion),
        questionMode,
      });

      const { data: faceStatus } = await api.get("/face/status");
      const nextPath = `/interview/${interview._id}`;

      if (!faceStatus.registered) {
        navigate("/face-setup", { state: { nextPath } });
      } else {
        navigate("/face-verify", { state: { nextPath } });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex items-center justify-center p-6">
      <div className="bg-white shadow-sm rounded-2xl p-8 w-full max-w-lg space-y-4">
        <h1 className="text-xl font-semibold">Configure your interview</h1>

        <div>
          <label className="block text-sm font-medium mb-1">Job Role</label>
          <select className="w-full border rounded-lg px-3 py-2" value={jobRole} onChange={(e) => setJobRole(e.target.value)}>
            {JOB_ROLE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {jobRole === "Other (type below)" && (
            <input
              className="w-full border rounded-lg px-3 py-2 mt-2"
              placeholder="Type your role, e.g. Technical Recruiter"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Interview Type</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={interviewType}
            onChange={(e) => setInterviewType(e.target.value)}
          >
            {INTERVIEW_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Experience Level</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
          >
            {EXPERIENCE_LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Number of Questions</label>
          <input
            type="number"
            min={3}
            max={20}
            className="w-full border rounded-lg px-3 py-2"
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Question Bank</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuestionModeChange("static")}
              className={`border rounded-lg px-3 py-2 text-sm text-left ${
                questionMode === "static" ? "border-indigo-600 bg-indigo-50" : ""
              }`}
            >
              <span className="font-medium">Static</span>
              <span className="block text-xs text-slate-400">Curated question bank</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuestionModeChange("dynamic")}
              className={`border rounded-lg px-3 py-2 text-sm text-left relative ${
                questionMode === "dynamic" ? "border-indigo-600 bg-indigo-50" : ""
              }`}
            >
              <span className="font-medium">Dynamic</span>
              <span className="block text-xs text-slate-400">
                Fresh AI-generated questions, more variety, never repeats
              </span>
            </button>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={panelMode} onChange={(e) => setPanelMode(e.target.checked)} />
            Panel Interview Mode
          </label>
          <p className="text-xs text-slate-400 mt-1">
            Questions alternate between two interviewer personas (an HR-style and a technical-style interviewer)
            instead of one generic voice.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Time per Question</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={timePerQuestion}
            onChange={(e) => setTimePerQuestion(e.target.value)}
          >
            <option value={0}>No timer</option>
            <option value={60}>60 seconds</option>
            <option value={90}>90 seconds</option>
            <option value={120}>120 seconds</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Target Company (optional)</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={companyPreset}
            onChange={(e) => setCompanyPreset(e.target.value)}
          >
            {COMPANY_PRESETS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {companyPreset === "Other" && (
            <input
              className="w-full border rounded-lg px-3 py-2 mt-2"
              placeholder="Type a company name"
              value={customCompany}
              onChange={(e) => setCustomCompany(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Job Description (optional)</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-[100px]"
            placeholder="Paste the job description here so questions match the specific requirements..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Resume (optional, PDF)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setResumeFile(e.target.files[0])} />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 transition text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {loading ? "Starting..." : "Start Interview"}
        </button>
      </div>
      </div>
    </div>
  );
}
