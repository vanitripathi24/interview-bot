import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/api";
import Navbar from "../components/Navbar";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, ChartTooltip, Legend);

export default function Report() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/interviews/${id}/report`)
      .then(({ data }) => setReport(data))
      .catch((err) => setError(err.response?.data?.message || "Could not load report"));
  }, [id]);

  const downloadPDF = () => {
    window.open(`${api.defaults.baseURL}/interviews/${id}/report/pdf`, "_blank");
  };

  const sectionEntries = Object.entries(report?.sectionScores || {});
  const radarData = {
    labels: sectionEntries.map(([section]) => section),
    datasets: [
      {
        label: "Score",
        data: sectionEntries.map(([, score]) => score),
        backgroundColor: "rgba(79, 70, 229, 0.2)",
        borderColor: "#4f46e5",
        pointBackgroundColor: "#4f46e5",
      },
    ],
  };
  const radarOptions = { scales: { r: { min: 0, max: 10, ticks: { stepSize: 2 } } } };

  if (error)
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <p className="p-6 text-red-500">{error}</p>
      </div>
    );
  if (!report)
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <p className="p-6 text-slate-400">Loading report...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold">Interview Report</h1>
            <button onClick={downloadPDF} className="border rounded-lg px-4 py-2 text-sm font-medium">
              Download PDF
            </button>
          </div>

          {report.proctoringFlagged && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              ⚠ This session was flagged during proctoring ({report.proctoringWarningsCount} warning
              {report.proctoringWarningsCount === 1 ? "" : "s"} logged).
            </div>
          )}

          <div>
            <p className="text-sm text-slate-400">Overall Score</p>
            <p className="text-3xl font-bold">{report.overallScore}/10</p>
          </div>

          <div>
            <h2 className="font-medium mb-2">Section-wise Scores</h2>
            {sectionEntries.length > 0 && (
              <div className="max-w-xs mx-auto mb-4">
                <Radar data={radarData} options={radarOptions} />
              </div>
            )}
            <ul className="space-y-1">
              {sectionEntries.map(([section, score]) => (
                <li key={section} className="flex justify-between text-sm border-b py-1">
                  <span>{section}</span>
                  <span>{score}/10</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-medium mb-1">Strengths</h2>
            <ul className="list-disc list-inside text-sm text-slate-600">
              {(report.strengths || []).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-medium mb-1">Weaknesses</h2>
            <ul className="list-disc list-inside text-sm text-slate-600">
              {(report.weaknesses || []).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-medium mb-1">Recommended Learning Topics</h2>
            <ul className="list-disc list-inside text-sm text-slate-600">
              {(report.learningTopics || []).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>

          {report.careerRoadmap && (
            <div>
              <h2 className="font-medium mb-1">Career Roadmap</h2>
              <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans">{report.careerRoadmap}</pre>
            </div>
          )}

          <div>
            <p className="text-sm text-slate-400">Hiring Recommendation</p>
            <p className="text-xl font-semibold">{report.recommendation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
