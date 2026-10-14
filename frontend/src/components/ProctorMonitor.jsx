import React, { useEffect, useRef, useState } from "react";
import { getHuman, loadFaceModels } from "../utils/faceModels";
import api from "../api/api";

const CHECK_INTERVAL_MS = 8000; // how often to check the frame
const WARNING_THRESHOLD = 4; // more than this many warnings -> flagged
// Every 6th presence check (~48s at the 8s interval above) also re-verifies
// WHO is on camera, not just how many faces are present — this catches a
// candidate handing off to someone else mid-interview after passing the
// initial face-lock check.
const REVERIFY_EVERY_N_TICKS = 6;
// How many faces the detector should report at once. Default is 1 (tuned
// for single-face use cases like face-lock) which would silently prevent
// "multiple faces" from ever being detected here.
const MAX_FACES_TO_DETECT = 5;

/**
 * Runs in the background during an interview: keeps its own tiny camera
 * feed, checks every few seconds for exactly one face, and reports a
 * warning up to the parent (which also logs it to the backend) when it
 * sees no face, more than one face, or (periodically) a face that no
 * longer matches the registered identity. This is a soft proctoring
 * signal, not a hard anti-cheat system — it flags for a reviewer, it
 * doesn't silently block anyone.
 *
 * Props:
 *   interviewId: string
 *   onFlagged(): called once, the moment warningsCount exceeds the threshold
 */
export default function ProctorMonitor({ interviewId, onFlagged }) {
  const videoRef = useRef(null);
  const [warningsCount, setWarningsCount] = useState(0);
  const [lastWarning, setLastWarning] = useState(null);
  const [ready, setReady] = useState(false);
  const flaggedRef = useRef(false);
  const tickCountRef = useRef(0);
  // Guards against overlapping detect() calls piling up if one check is
  // still running when the next interval tick fires.
  const detectingRef = useRef(false);

  // onFlagged is a fresh function reference on every parent re-render (e.g.
  // every keystroke while typing an answer). Storing it in a ref — rather
  // than the effect's dependency array — means the camera-setup effect
  // below only runs once per interview, instead of tearing down and
  // restarting the camera stream on every render (which caused a visible
  // black/white flicker).
  const onFlaggedRef = useRef(onFlagged);
  useEffect(() => {
    onFlaggedRef.current = onFlagged;
  }, [onFlagged]);

  useEffect(() => {
    let stream;
    let intervalId;
    let cancelled = false;

    async function logWarning(type) {
      try {
        const { data } = await api.post(`/interviews/${interviewId}/warning`, { type });
        setWarningsCount(data.warningsCount);
        setLastWarning(type);

        if (data.flagged && !flaggedRef.current) {
          flaggedRef.current = true;
          onFlaggedRef.current?.();
        }
      } catch (err) {
        console.error("Failed to log proctoring warning:", err.message);
      }
    }

    async function start() {
      try {
        await loadFaceModels();
        stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        if (cancelled) return;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);

        intervalId = setInterval(checkFrame, CHECK_INTERVAL_MS);
      } catch (err) {
        // If camera access fails here, we simply don't proctor rather than
        // blocking the interview — the candidate already granted camera
        // access once for face-lock, so this is a rare edge case.
        console.error("Proctoring camera unavailable:", err.message);
      }
    }

    async function checkFrame() {
      if (!videoRef.current || detectingRef.current) return;
      detectingRef.current = true;
      tickCountRef.current += 1;

      try {
        // On most ticks we only need a face count, so mesh/description stay
        // off for speed. Every REVERIFY_EVERY_N_TICKS we also need the
        // recognition embedding to confirm it's still the same person.
        const isReverifyTick = tickCountRef.current % REVERIFY_EVERY_N_TICKS === 0;
        const human = getHuman();
        const result = await human.detect(videoRef.current, {
          face: {
            detector: { maxDetected: MAX_FACES_TO_DETECT, rotation: isReverifyTick },
            mesh: { enabled: isReverifyTick },
            description: { enabled: isReverifyTick },
          },
        });

        const faceCount = result.face.length;
        if (faceCount === 0) {
          await logWarning("no_face");
          return;
        }
        if (faceCount > 1) {
          await logWarning("multiple_faces");
          return;
        }

        // Exactly one face present — on the periodic interval, also confirm
        // it's still the SAME person who registered/verified at the start.
        if (isReverifyTick) {
          try {
            const embedding = result.face[0]?.embedding;
            if (embedding) {
              const { data } = await api.post("/face/verify", { descriptor: embedding });
              if (!data.match) {
                await logWarning("identity_mismatch");
              }
            }
          } catch (err) {
            // A missing registered face (404) or a transient error here
            // shouldn't interrupt the interview — just skip this check.
            console.error("Periodic identity re-verification failed:", err.message);
          }
        }
      } finally {
        detectingRef.current = false;
      }
    }

    start();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [interviewId]);

  const warningLabel = {
    no_face: "No face detected",
    multiple_faces: "Multiple faces detected",
    identity_mismatch: "Face didn't match registration",
  };

  return (
    <div className="fixed bottom-4 right-4 w-40 bg-white rounded-lg shadow-lg border overflow-hidden z-50">
      <video ref={videoRef} autoPlay muted playsInline className="w-full aspect-video object-cover bg-black" />
      <div className="p-2 text-xs">
        <p className="text-slate-400">{ready ? "Proctoring active" : "Starting camera..."}</p>
        {warningsCount > 0 && (
          <p className={`font-medium ${warningsCount > WARNING_THRESHOLD ? "text-red-600" : "text-amber-600"}`}>
            Warning {warningsCount}/{WARNING_THRESHOLD + 1}
            {lastWarning ? ` — ${warningLabel[lastWarning]}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
