import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAdmin } from "../utils/auth";

export default function Navbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <nav className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 py-3 flex justify-between items-center">
        <Link to="/dashboard" className="font-semibold text-slate-900 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm">AI</span>
          Interview Copilot
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/dashboard" className="text-slate-500 hover:text-slate-900">
            Dashboard
          </Link>
          {isAdmin() && (
            <Link to="/recruiter" className="text-slate-500 hover:text-slate-900">
              Recruiter View
            </Link>
          )}
          <Link to="/account" className="text-slate-500 hover:text-slate-900">
            Account
          </Link>
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-500">
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
