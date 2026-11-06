"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const PAUSED_KEY = "hero-video-paused";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const SMALL_SCREEN_QUERY = "(max-width: 767px)";
const SLOW_CONNECTIONS = ["slow-2g", "2g"];

type NetworkInformation = EventTarget & { saveData?: boolean; effectiveType?: string };
type VideoSource = { src: string; type: string };

const getConnection = () =>
  (navigator as Navigator & { connection?: NetworkInformation }).connection;

const readPaused = () => {
  try {
    return sessionStorage.getItem(PAUSED_KEY) === "true";
  } catch {
    return false;
  }
};

const writePaused = (paused: boolean) => {
  try {
    sessionStorage.setItem(PAUSED_KEY, String(paused));
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the toggle still works per page.
  }
};

const subscribeToEnvironment = (onChange: () => void) => {
  const queries = [matchMedia(REDUCED_MOTION_QUERY), matchMedia(SMALL_SCREEN_QUERY)];
  const connection = getConnection();
  queries.forEach((query) => query.addEventListener("change", onChange));
  connection?.addEventListener("change", onChange);

  return () => {
    queries.forEach((query) => query.removeEventListener("change", onChange));
    connection?.removeEventListener("change", onChange);
  };
};

const getPrefersPoster = () => {
  const connection = getConnection();
  return (
    matchMedia(REDUCED_MOTION_QUERY).matches ||
    Boolean(connection?.saveData) ||
    SLOW_CONNECTIONS.includes(connection?.effectiveType ?? "")
  );
};

const getIsSmallScreen = () => matchMedia(SMALL_SCREEN_QUERY).matches;

/**
 * Drives the hero background video. The poster renders on the server and stays the LCP element;
 * the video only mounts on the client, and only when motion, data-saver and connection checks
 * allow it. Playback pauses off-screen and in hidden tabs, and the visitor's pause choice
 * persists for the session (WCAG 2.2.2).
 */
export const useHeroVideo = (baseUrl?: string) => {
  const ref = useRef<HTMLVideoElement>(null);
  const prefersPoster = useSyncExternalStore(subscribeToEnvironment, getPrefersPoster, () => true);
  const isSmallScreen = useSyncExternalStore(subscribeToEnvironment, getIsSmallScreen, () => false);
  const [hasFailed, setHasFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(() =>
    typeof window === "undefined" ? false : readPaused(),
  );

  const shouldUsePoster = !baseUrl || prefersPoster || hasFailed;

  const sources = useMemo<VideoSource[]>(() => {
    if (!baseUrl) return [];
    return [
      {
        src: `${baseUrl}/${isSmallScreen ? "hero-720" : "hero-1080"}.webm`,
        type: "video/webm",
      },
    ];
  }, [baseUrl, isSmallScreen]);

  const sourceKey = sources.map((source) => source.src).join("|");

  useEffect(() => {
    const video = ref.current;
    if (shouldUsePoster || !video) return;

    let isInView = true;
    const sync = () => {
      if (isInView && !document.hidden && !readPaused()) {
        video.play().catch(() => setIsPlaying(false));
      } else {
        video.pause();
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      isInView = entry.isIntersecting;
      sync();
    });
    const frame = requestAnimationFrame(() => {
      video.preload = "auto";
      observer.observe(video);
    });
    document.addEventListener("visibilitychange", sync);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [shouldUsePoster, sourceKey]);

  const toggle = useCallback(() => {
    const video = ref.current;
    if (!video) return;

    const willPause = !video.paused;
    writePaused(willPause);
    setIsUserPaused(willPause);

    if (willPause) video.pause();
    else video.play().catch(() => setIsPlaying(false));
  }, []);

  const videoProps = {
    onPlay: () => setIsPlaying(true),
    onPlaying: () => setHasStarted(true),
    onPause: () => setIsPlaying(false),
  };

  return {
    ref,
    isPlaying,
    toggle,
    shouldUsePoster,
    sources,
    sourceKey,
    hasStarted,
    showPauseIcon: isPlaying || (!hasStarted && !isUserPaused),
    videoProps,
    onLastSourceError: () => setHasFailed(true),
  };
};
