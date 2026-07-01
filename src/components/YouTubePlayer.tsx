/// <reference types="react" />
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number; target: YTPlayer }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YTPlayer = {
  loadVideoById: (opts: { videoId: string; startSeconds?: number } | string) => void;
  cueVideoById: (opts: { videoId: string; startSeconds?: number } | string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

function loadYouTubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return;
    if (window.YT && window.YT.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve();
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
}

export function YouTubePlayer({
  videoId,
  isPlaying,
  targetPosition,
  onReady,
  onEnded,
  onLocalStateChange,
}: {
  videoId: string | null;
  isPlaying: boolean;
  /** absolute position (in seconds) we should currently be at */
  targetPosition: number;
  onReady?: (p: YTPlayer) => void;
  onEnded?: () => void;
  onLocalStateChange?: (state: "playing" | "paused" | "ended") => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const currentVideoRef = useRef<string | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadYouTubeApi();
      if (cancelled || !containerRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: videoId ?? undefined,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (e) => {
            readyRef.current = true;
            currentVideoRef.current = videoId;
            onReady?.(e.target);
            if (videoId) {
              e.target.seekTo(Math.max(0, targetPosition), true);
              if (isPlaying) e.target.playVideo();
            }
          },
          onStateChange: (e) => {
            const YT = window.YT!;
            if (e.data === YT.PlayerState.ENDED) {
              onLocalStateChange?.("ended");
              onEnded?.();
            } else if (e.data === YT.PlayerState.PLAYING) {
              onLocalStateChange?.("playing");
            } else if (e.data === YT.PlayerState.PAUSED) {
              onLocalStateChange?.("paused");
            }
          },
        },
      });
    })();
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {}
      playerRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to videoId changes
  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    if (videoId && currentVideoRef.current !== videoId) {
      currentVideoRef.current = videoId;
      playerRef.current.loadVideoById({
        videoId,
        startSeconds: Math.max(0, targetPosition),
      });
      if (!isPlaying) playerRef.current.pauseVideo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // React to play/pause
  useEffect(() => {
    if (!readyRef.current || !playerRef.current || !videoId) return;
    if (isPlaying) playerRef.current.playVideo();
    else playerRef.current.pauseVideo();
  }, [isPlaying, videoId]);

  // Drift correction
  useEffect(() => {
    if (!readyRef.current || !playerRef.current || !videoId) return;
    const cur = playerRef.current.getCurrentTime();
    if (Math.abs(cur - targetPosition) > 2.5) {
      playerRef.current.seekTo(Math.max(0, targetPosition), true);
    }
  }, [targetPosition, videoId]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
