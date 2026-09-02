import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { loadFaceModels } from "../utils/faceModels";

const LIVENESS_CHECK_INTERVAL_MS = 200;
const REQUIRED_BLINKS = 1;
// Eye Aspect Ratio thresholds. A blink is: EAR drops below CLOSED, then
// rises back above OPEN. Two thresholds (not one) avoid flicker right at
// the boundary from counting as multiple blinks.
const EAR_CLOSED_THRESHOLD = 0.23;
const EAR_OPEN_THRESHOLD = 0.27;

// Distance between two landmark points.
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Standard eye-aspect-ratio formula from a 6-point eye landmark set.
// Lower value = eye more closed. A static photo's EAR never changes frame
// to frame, which is exactly what this is designed to catch.
function eyeAspectRatio(eye) {
  const vertical1 = dist(eye[1], eye[5]);
  const vertical2 = dist(eye[2], eye[4]);
  const horizontal = dist(eye[0], eye[3]);
  return (vertical1 + vertical2) / (2 * horizontal);
}

/**
 * Renders a live webcam feed. Before allowing a capture, requires the
 * person to blink at least once — this is a basic liveness check so a
 * printed photo or a phone held up to the camera can't be used to
 * register or verify a face, since a static image can never blink.
 *
 * Props:
 *   onCapture(descriptor: number[]) - called with the extracted descriptor
 *   buttonLabel: string
 */
export default function FaceCapture({ onCapture, buttonLabel = "Capture Face" }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | watching | capturing | error | no-face
  const [error, setError] = useState("");
  const [blinkCount, setBlinkCount] = useState(0);
  const eyesClosedRef = useRef(false);
  const livenessPassedRef = useRef(false);

  useEffect(() => {
    let stream;
    let livenessIntervalId;
    let cancelled = false;

    async function start() {
      try {
        await loadFaceModels();
        stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        if (cancelled) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus("watching");
        livenessIntervalId = setInterval(checkForBlink, LIVENESS_CHECK_INTERVAL_MS);
      } catch (err) {
        setError(err.message || "Could not access camera or load face-detection models.");
        setStatus("error");
      }
    }

    async function checkForBlink() {
      if (!videoRef.current || livenessPassedRef.current) return;

      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      if (!detection) return; // no face this frame — just wait for the next one

      const leftEAR = eyeAspectRatio(detection.landmarks.getLeftEye());
      const rightEAR = eyeAspectRatio(detection.landmarks.getRightEye());
      const avgEAR = (leftEAR + rightEAR) / 2;

      if (avgEAR < EAR_CLOSED_THRESHOLD) {
        eyesClosedRef.current = true;
      } else if (avgEAR > EAR_OPEN_THRESHOLD && eyesClosedRef.current) {
        // Eyes just went from closed to open — that's one completed blink.
        eyesClosedRef.current = false;
        setBlinkCount((prev) => {
          const next = prev + 1;
          if (next >= REQUIRED_BLINKS) {
            livenessPassedRef.current = true;
            clearInterval(livenessIntervalId);
          }
          return next;
        });
      }
    }

    start();

    return () => {
      cancelled = true;
      if (livenessIntervalId) clearInterval(livenessIntervalId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = async () => {
    setStatus("capturing");
    setError("");
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus("no-face");
        setError("No face detected. Make sure your face is clearly visible and well-lit, then try again.");
        return;
      }

      setStatus("watching");
      onCapture(Array.from(detection.descriptor));
    } catch (err) {
      setError(err.message || "Something went wrong capturing your face.");
      setStatus("error");
    }
  };

  const livenessPassed = blinkCount >= REQUIRED_BLINKS;

  return (
    <div className="space-y-3">
      <div className="rounded-lg overflow-hidden bg-black aspect-video">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
      </div>

      {status === "loading" && <p className="text-sm text-slate-400">Loading camera and face-detection models...</p>}

      {status === "watching" && !livenessPassed && (
        <p className="text-sm text-amber-600">
          Please blink naturally so we can confirm this is a live camera, not a photo — waiting for a blink...
        </p>
      )}
      {livenessPassed && status !== "capturing" && (
        <p className="text-sm text-green-600">Liveness confirmed — you can capture now.</p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={handleCapture}
        disabled={status === "loading" || status === "capturing" || !livenessPassed}
        className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium disabled:opacity-50"
      >
        {status === "capturing" ? "Analyzing..." : !livenessPassed ? "Waiting for blink..." : buttonLabel}
      </button>
    </div>
  );
}
