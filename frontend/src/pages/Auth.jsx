import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/signup";
      const { data } = await api.post(path, form);
      localStorage.setItem("token", data.token);
      navigate("/configure");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    }
  };

  const handleGuest = async () => {
    try {
      const { data } = await api.post("/auth/guest", { name: form.name });
      localStorage.setItem("token", data.token);
      navigate("/configure");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-50 to-white">
      <div className="bg-white shadow-sm rounded-2xl p-8 w-full max-w-sm">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-semibold mb-4">
          AI
        </div>
        <h1 className="text-2xl font-semibold mb-1">AI Interview Copilot</h1>
        <p className="text-slate-500 mb-6 text-sm">Practice interviews with an AI that adapts to you.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Name"
              name="name"
              value={form.name}
              onChange={handleChange}
            />
          )}
          <input
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Email"
            name="email"
            value={form.email}
            onChange={handleChange}
          />
          <input
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 transition text-white rounded-lg py-2 font-medium">
            {mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-sm text-slate-500 mt-3 underline"
        >
          {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
        </button>

        <div className="mt-6 border-t pt-4">
          <input
            className="w-full border rounded-lg px-3 py-2 mb-2"
            placeholder="Your name (optional)"
            name="name"
            value={form.name}
            onChange={handleChange}
          />
          <button onClick={handleGuest} className="w-full border rounded-lg py-2 font-medium">
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
