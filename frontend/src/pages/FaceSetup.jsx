import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import FaceCapture from "../components/FaceCapture";

export default function FaceSetup() {
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleCapture = async (descriptor) => {
    if (!consent) {
      setError("Please check the consent box above before capturing your face.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/face/register", { descriptor, consent: true });
      navigate("/configure");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white shadow-md rounded-xl p-8 w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Set up face verification</h1>
        <p className="text-sm text-slate-500">
          This organization requires a one-time face verification step before starting an interview, to confirm
          it's really you. We store only a mathematical description of your face (not the photo itself), and you
          can delete it at any time from your account settings.
        </p>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
          <span>
            I consent to this platform capturing and storing a biometric face descriptor for identity verification
            purposes, and understand I can withdraw this consent and delete my data at any time.
          </span>
        </label>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <FaceCapture onCapture={handleCapture} buttonLabel={saving ? "Saving..." : "Register My Face"} />

        <button onClick={() => navigate("/configure")} className="w-full text-sm text-slate-400 underline">
          Skip for now
        </button>
      </div>
    </div>
  );
}
