import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip } from "chart.js";
import api from "../api/api";
import Navbar from "../components/Navbar";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get("/dashboard/stats").then(({ data }) => setStats(data));
    api.get("/dashboard/interviews").then(({ data }) => setHistory(data));
  }, []);

  const chartData = {
    labels: (stats?.trend || []).map((t) => new Date(t.date).toLocaleDateString()),
    datasets: [
      {
        label: "Score",
        data: (stats?.trend || []).map((t) => t.score),
        borderColor: "#4f46e5",
        backgroundColor: "#4f46e5",
        tension: 0.3,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-3xl mx-auto space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <Link to="/configure" className="bg-indigo-600 hover:bg-indigo-700 transition text-white rounded-lg px-4 py-2 text-sm font-medium">
            New Interview
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm text-slate-400">Total Interviews</p>
            <p className="text-3xl font-bold mt-1">{stats?.totalInterviews ?? "-"}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm text-slate-400">Average Score</p>
            <p className="text-3xl font-bold mt-1">{stats?.averageScore ?? "-"}<span className="text-lg text-slate-400">/10</span></p>
          </div>
        </div>

        {stats?.trend?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm text-slate-400 mb-3">Performance Trend</p>
            <Line data={chartData} />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm text-slate-400 mb-2">Interview History</p>
          <ul className="divide-y">
            {history.map(({ interview, report }) => (
              <li key={interview._id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    {interview.jobRole} — {interview.interviewType}
                    {interview.targetCompany && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                        {interview.targetCompany}
                      </span>
                    )}
                    {interview.questionMode === "dynamic" && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">Dynamic</span>
                    )}
                    {interview.flagged && (
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Flagged</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    {interview.status} · {new Date(interview.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {report ? (
                  <Link to={`/report/${interview._id}`} className="text-sm text-indigo-600 hover:underline">
                    View report ({report.overallScore}/10)
                  </Link>
                ) : (
                  <Link to={`/interview/${interview._id}`} className="text-sm text-indigo-600 hover:underline">
                    Continue
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
