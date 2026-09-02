import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import Navbar from "../components/Navbar";

const RECOMMENDATION_COLORS = {
  "Strong Hire": "bg-green-50 text-green-700",
  Hire: "bg-emerald-50 text-emerald-700",
  Hold: "bg-amber-50 text-amber-700",
  Reject: "bg-red-50 text-red-700",
};

export default function RecruiterDashboard() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState("score-desc");
  const [roleFilter, setRoleFilter] = useState("All");
  const [companyFilter, setCompanyFilter] = useState("All");

  useEffect(() => {
    api
      .get("/admin/reports")
      .then(({ data }) => setReports(data))
      .catch((err) => setError(err.response?.data?.message || "Could not load reports (admin access required)"));
  }, []);

  const roles = useMemo(() => ["All", ...new Set(reports.map((r) => r.interview?.jobRole).filter(Boolean))], [reports]);
  const companies = useMemo(
    () => ["All", ...new Set(reports.map((r) => r.interview?.targetCompany).filter(Boolean))],
    [reports]
  );

  const filtered = reports
    .filter((r) => roleFilter === "All" || r.interview?.jobRole === roleFilter)
    .filter((r) => companyFilter === "All" || r.interview?.targetCompany === companyFilter)
    .sort((a, b) => {
      if (sortKey === "score-desc") return (b.overallScore || 0) - (a.overallScore || 0);
      if (sortKey === "score-asc") return (a.overallScore || 0) - (b.overallScore || 0);
      if (sortKey === "date-desc") return new Date(b.createdAt) - new Date(a.createdAt);
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Recruiter Dashboard</h1>
        <p className="text-sm text-slate-500">Every candidate interview conducted on this platform, in one place.</p>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {!error && (
          <>
            <div className="flex gap-3 flex-wrap">
              <select className="border rounded-lg px-3 py-2 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <select className="border rounded-lg px-3 py-2 text-sm" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
                {companies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select className="border rounded-lg px-3 py-2 text-sm" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                <option value="score-desc">Highest score first</option>
                <option value="score-asc">Lowest score first</option>
                <option value="date-desc">Most recent first</option>
              </select>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left">
                  <tr>
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Recommendation</th>
                    <th className="px-4 py-3">Flagged</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((r) => (
                    <tr key={r._id}>
                      <td className="px-4 py-3">{r.interview?.user?.name || "—"}</td>
                      <td className="px-4 py-3">{r.interview?.jobRole}</td>
                      <td className="px-4 py-3">{r.interview?.targetCompany || "—"}</td>
                      <td className="px-4 py-3">{r.interview?.interviewType}</td>
                      <td className="px-4 py-3 font-medium">{r.overallScore}/10</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${RECOMMENDATION_COLORS[r.recommendation] || "bg-slate-100"}`}>
                          {r.recommendation}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.proctoringFlagged ? <span className="text-red-500 text-xs">⚠ Flagged</span> : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/report/${r.interview?._id}`} className="text-indigo-600 text-xs hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                        No interviews match these filters yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
