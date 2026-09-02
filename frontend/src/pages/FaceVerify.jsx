import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";
import FaceCapture from "../components/FaceCapture";

export default function FaceVerify() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const nextPath = location.state?.nextPath || "/dashboard";

  const handleCapture = async (descriptor) => {
    setError("");
    setResult(null);
    try {
      const { data } = await api.post("/face/verify", { descriptor });
      setResult(data);
      if (data.match) {
        setTimeout(() => navigate(nextPath), 800);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white shadow-md rounded-xl p-8 w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Verify it's you</h1>
        <p className="text-sm text-slate-500">
          Look at the camera and capture to confirm your identity before the interview begins.
        </p>

        <FaceCapture onCapture={handleCapture} buttonLabel="Verify My Face" />

        {result && result.match && <p className="text-green-600 text-sm font-medium">Verified — starting your interview...</p>}
        {result && !result.match && (
          <p className="text-red-500 text-sm">
            Face didn't match our records (distance: {result.distance}). Make sure you're well-lit and try again.
          </p>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    </div>
  );
}
