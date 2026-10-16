import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/api";

// Browsers won't let JS literally block tab-switching or force the user
// back into fullscreen without a click — only detect + log it, same as
// every real web-based proctoring tool. Copy/paste/right-click, however,
// CAN be prevented outright, so those are blocked as well as logged.
const DUPLICATE_WARNING_WINDOW_MS = 1000; // visibilitychange + blur often fire together for one real event

/**
 * Enforces/monitors "official interview" integrity signals for the page
 * it's mounted on: fullscreen requirement, tab/window switching, and
 * copy/cut/paste/right-click. Warnings feed the same
 * POST /interviews/:id/warning endpoint (and the same flagged-threshold)
 * that ProctorMonitor's face-related warnings already use.
 *
 * Set `enabled` to false once the interview is finished to stop
 * enforcing and release any listeners' effect on the page.
 */
const FULLSCREEN_SUPPORTED = typeof document !== "undefined" && !!document.documentElement.requestFullscreen;

export default function useExamIntegrity(interviewId, onFlagged, enabled = true, onWarning) {
  // If the browser doesn't support the Fullscreen API at all (older Safari,
  // some embedded/iframe contexts), there's nothing to enforce — treat it as
  // satisfied rather than permanently blocking the candidate behind a gate
  // they have no way to clear.
  const [isFullscreen, setIsFullscreen] = useState(FULLSCREEN_SUPPORTED ? !!document.fullscreenElement : true);
  const [lastWarning, setLastWarning] = useState(null);
  const flaggedRef = useRef(false);
  const lastLoggedRef = useRef({ type: null, at: 0 });

  const onFlaggedRef = useRef(onFlagged);
  useEffect(() => {
    onFlaggedRef.current = onFlagged;
  }, [onFlagged]);
  const onWarningRef = useRef(onWarning);
  useEffect(() => {
    onWarningRef.current = onWarning;
  }, [onWarning]);

  const logWarning = useCallback(
    async (type) => {
      if (!enabled) return;
      const now = Date.now();
      if (lastLoggedRef.current.type === type && now - lastLoggedRef.current.at < DUPLICATE_WARNING_WINDOW_MS) return;
      lastLoggedRef.current = { type, at: now };
      setLastWarning({ type, at: now });

      try {
        const { data } = await api.post(`/interviews/${interviewId}/warning`, { type });
        onWarningRef.current?.(type, data.warningsCount);
        if (data.flagged && !flaggedRef.current) {
          flaggedRef.current = true;
          onFlaggedRef.current?.();
        }
      } catch (err) {
        console.error("Failed to log integrity warning:", err.message);
      }
    },
    [interviewId, enabled]
  );

  const requestFullscreen = useCallback(() => {
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    request?.call(el).catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function handleFullscreenChange() {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) logWarning("fullscreen_exit");
    }

    function handleVisibilityChange() {
      if (document.hidden) logWarning("tab_switch");
    }

    function handleWindowBlur() {
      logWarning("tab_switch");
    }

    function blockAndWarn(type) {
      return (e) => {
        e.preventDefault();
        logWarning(type);
      };
    }

    const handleCopy = blockAndWarn("copy_paste");
    const handleCut = blockAndWarn("copy_paste");
    const handlePaste = blockAndWarn("copy_paste");
    const handleContextMenu = blockAndWarn("right_click");

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [enabled, logWarning]);

  return { isFullscreen, lastWarning, requestFullscreen };
}
