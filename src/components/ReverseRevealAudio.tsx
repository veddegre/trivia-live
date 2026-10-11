"use client";

import { useEffect, useRef, useState } from "react";
import { reverseAudioBuffer } from "@/lib/audio-reverse";

type Props = {
  src: string;
  openedAt?: string | null;
  revealed?: boolean;
  pausedAt?: string | null;
  /** Called when the host taps Play (before audio starts). Should arm the round clock. */
  onPlayRequest?: () => void | Promise<void>;
  className?: string;
};

function createAudioContext(): AudioContext {
  const Ctx =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) throw new Error("Audio is not supported in this browser");
  return new Ctx();
}

export function ReverseRevealAudio({
  src,
  openedAt,
  revealed = false,
  pausedAt = null,
  onPlayRequest,
  className = "",
}: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const anchorRef = useRef(0);
  const offsetRef = useRef(0);
  const resumeAfterHold = useRef(false);
  const startRef = useRef<
    ((buffer: AudioBuffer, loop: boolean, startOffset?: number) => Promise<void>) | null
  >(null);
  const forwardRef = useRef<AudioBuffer | null>(null);
  const backwardRef = useRef<AudioBuffer | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  function context(): AudioContext {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = createAudioContext();
    }
    return ctxRef.current;
  }

  function stop() {
    const source = sourceRef.current;
    sourceRef.current = null;
    if (!source) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
  }

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setPlaying(false);
    setError("");
    forwardRef.current = null;
    backwardRef.current = null;
    offsetRef.current = 0;
    resumeAfterHold.current = false;
    stop();

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error("Could not load the clip");
        const bytes = await res.arrayBuffer();
        if (cancelled) return;
        const ctx = context();
        const decoded = await ctx.decodeAudioData(bytes.slice(0));
        if (cancelled) return;
        forwardRef.current = decoded;
        backwardRef.current = reverseAudioBuffer(ctx, decoded);
        setReady(true);
      } catch {
        if (!cancelled) setError("Could not prepare this clip");
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [src, attempt]);

  useEffect(() => {
    stop();
    setPlaying(false);
    offsetRef.current = 0;
    resumeAfterHold.current = false;
  }, [revealed]);

  useEffect(() => {
    if (pausedAt) {
      const ctx = ctxRef.current;
      const source = sourceRef.current;
      if (!ctx || !source) return;
      const duration = source.buffer?.duration ?? 0;
      let offset = ctx.currentTime - anchorRef.current;
      if (duration > 0) offset = offset % duration;
      offsetRef.current = Math.max(0, offset);
      resumeAfterHold.current = true;
      stop();
      setPlaying(false);
      return;
    }
    if (!resumeAfterHold.current) return;
    resumeAfterHold.current = false;
    const buffer = revealed ? forwardRef.current : backwardRef.current;
    if (!buffer) return;
    void startRef.current?.(buffer, !revealed, offsetRef.current);
  }, [pausedAt, revealed, playing]);

  useEffect(() => {
    return () => {
      stop();
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  async function start(buffer: AudioBuffer, loop: boolean, startOffset = 0) {
    const ctx = context();
    if (ctx.state === "suspended") await ctx.resume();
    stop();
    const duration = buffer.duration;
    const offset =
      duration > 0 ? ((startOffset % duration) + duration) % duration : 0;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(ctx.destination);
    source.onended = () => {
      if (sourceRef.current === source) {
        sourceRef.current = null;
        setPlaying(false);
      }
    };
    sourceRef.current = source;
    const when = ctx.currentTime;
    source.start(when, offset);
    anchorRef.current = when - offset;
    setPlaying(true);
  }

  startRef.current = start;

  async function handlePlay() {
    if (pausedAt) return;
    setError("");
    const buffer = revealed ? forwardRef.current : backwardRef.current;
    if (!buffer) {
      setError(ready ? "Could not prepare this clip" : "Clip is still loading");
      return;
    }
    try {
      if (!revealed && onPlayRequest) await onPlayRequest();
      const next = revealed ? forwardRef.current : backwardRef.current;
      if (!next) throw new Error("Clip is not ready");
      await start(next, !revealed);
    } catch {
      setError("Could not play — check the host volume / browser autoplay");
      setPlaying(false);
    }
  }

  const waitingForHost = !revealed && !openedAt && !onPlayRequest;

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-line bg-ink-2/70 px-6 py-8 ${className}`}
    >
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber">
        {revealed ? "Forwards" : "Backwards"}
      </div>
      <p className="mt-2 text-center text-sm text-muted">
        {error
          ? error
          : !ready
            ? "Preparing clip…"
            : revealed
              ? "Replay the song forwards"
              : pausedAt
                ? "Paused"
                : playing
                  ? "Listening…"
                  : onPlayRequest
                    ? "Tap play to start the clip backwards and the timer"
                    : openedAt
                      ? "Tap play to listen on this screen"
                      : "Waiting for the host to play"}
      </p>
      <button
        type="button"
        className="btn mt-5 px-10 uppercase tracking-wide"
        disabled={!!pausedAt || (error && !ready ? false : !ready || waitingForHost)}
        onClick={() => {
          if (error && !ready) {
            setAttempt((n) => n + 1);
            return;
          }
          void handlePlay();
        }}
      >
        {error && !ready
          ? "Try again"
          : revealed
            ? "Replay forwards"
            : pausedAt
              ? "Paused"
              : playing
                ? "Playing…"
                : "Play backwards"}
      </button>
    </div>
  );
}
