import React, { useEffect, useRef, useState } from "react";
import { getHuman, loadFaceModels } from "../utils/faceModels";

const LIVENESS_CHECK_INTERVAL_MS = 200;
const REQUIRED_BLINKS = 1;
// Eye Aspect Ratio thresholds. A blink is: EAR drops below CLOSED, then
// rises back above OPEN. Two thresholds (not one) avoid flicker right at
// the boundary from counting as multiple blinks.
const EAR_CLOSED_THRESHOLD = 0.23;
const EAR_OPEN_THRESHOLD = 0.27;

// 6-point eye contour (outer corner, 2 upper-lid, inner corner, 2 lower-lid)
// into Human's 468-point face mesh — the standard subset used for
// eye-aspect-ratio blink detection on this mesh topology.
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

// Distance between two mesh points ([x, y, z?]).
function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// Standard eye-aspect-ratio formula from a 6-point eye landmark set.
// Lower value = eye more closed. A static photo's EAR never changes frame
// to frame, which is exactly what this is designed to catch.
function eyeAspectRatio(mesh, indices) {
  const [p0, p1, p2, p3, p4, p5] = indices.map((i) => mesh[i]);
  const vertical1 = dist(p1, p5);
  const vertical2 = dist(p2, p4);
  const horizontal = dist(p0, p3);
  return (vertical1 + vertical2) / (2 * horizontal);
}

/**
 * Renders a live webcam feed. Before allowing a capture, requires the
 * person to blink at least once — this is a basic liveness check so a
 * printed photo or a phone held up to the camera can't be used to
 * register or verify a face, since a static image can never blink.
 *
 * Props:
 *   onCapture(embedding: number[]) - called with the extracted face embedding
 *   buttonLabel: string
 */
export default function FaceCapture({ onCapture, buttonLabel = "Capture Face" }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | watching | capturing | error | no-face
  const [error, setError] = useState("");
  const [blinkCount, setBlinkCount] = useState(0);
  const eyesClosedRef = useRef(false);
  const livenessPassedRef = useRef(false);
  // Guards against overlapping detect() calls: if one check is still
  // running when the next interval tick fires, skip that tick instead of
  // starting a second detection in parallel. Without this, a detector
  // slower than the poll interval causes calls to pile up faster than
  // they resolve, and liveness can take minutes instead of seconds.
  const detectingRef = useRef(false);

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
      if (!videoRef.current || livenessPassedRef.current || detectingRef.current) return;
      detectingRef.current = true;
      try {
        const human = getHuman();
        const result = await human.detect(videoRef.current, {
          face: { description: { enabled: false } },
        });
        const face = result.face[0];
        if (!face) return; // no face this frame — just wait for the next one

        const leftEAR = eyeAspectRatio(face.mesh, LEFT_EYE);
        const rightEAR = eyeAspectRatio(face.mesh, RIGHT_EYE);
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
      } finally {
        detectingRef.current = false;
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
      const human = getHuman();
      const result = await human.detect(videoRef.current, {
        face: { detector: { rotation: true }, description: { enabled: true } },
      });
      const face = result.face[0];

      if (!face || !face.embedding) {
        setStatus("no-face");
        setError("No face detected. Make sure your face is clearly visible and well-lit, then try again.");
        return;
      }

      setStatus("watching");
      onCapture(face.embedding);
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
