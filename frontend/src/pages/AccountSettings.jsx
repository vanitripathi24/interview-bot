import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import Navbar from "../components/Navbar";

export default function AccountSettings() {
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/face/status").then(({ data }) => setStatus(data));
  }, []);

  const handleDelete = async () => {
    if (!window.confirm("This will permanently delete your stored face data. You'll need to re-register before your next interview. Continue?")) {
      return;
    }
    try {
      await api.delete("/face");
      setStatus({ registered: false, consentGiven: false });
      setMessage("Your face data has been deleted.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-4">
          <h1 className="text-xl font-semibold">Account & Privacy Settings</h1>

          <div className="border rounded-xl p-4 space-y-2">
            <h2 className="font-medium">Biometric Face Data</h2>
            <p className="text-sm text-slate-500">
              {status?.registered
                ? "You have a face registered for identity verification before interviews."
                : "No face data is currently stored for your account."}
            </p>
            {status?.registered && (
              <button onClick={handleDelete} className="text-sm text-red-500 underline">
                Delete my face data
              </button>
            )}
            {!status?.registered && (
              <button onClick={() => navigate("/face-setup")} className="text-sm text-indigo-600 underline">
                Set up face verification
              </button>
            )}
            {message && <p className="text-xs text-slate-400">{message}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
