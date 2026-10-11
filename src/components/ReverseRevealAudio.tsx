"use client";

import { useEffect, useRef, useState } from "react";
import { reverseAudioBuffer } from "@/lib/audio-reverse";
import {
  decodeAudioBuffer,
  pokeAudioContext,
  startClip,
  type ArmedContext,
  type LiveClip,
} from "@/lib/web-audio-clip";

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
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
  const clipRef = useRef<LiveClip | null>(null);
  const holdRef = useRef<ArmedContext | null>(null);
  const offsetRef = useRef(0);
  const resumeAfterHold = useRef(false);
  const forwardRef = useRef<AudioBuffer | null>(null);
  const backwardRef = useRef<AudioBuffer | null>(null);
  const bytesRef = useRef<ArrayBuffer | null>(null);
  const revealedRef = useRef(revealed);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  revealedRef.current = revealed;

  function context(): AudioContext {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = createAudioContext();
    }
    return ctxRef.current;
  }

  function stopClip() {
    clipRef.current?.stop();
    clipRef.current = null;
  }

  async function buffersFrom(ctx: AudioContext, bytes: ArrayBuffer) {
    const decoded = await decodeAudioBuffer(ctx, bytes);
    return { forward: decoded, backward: reverseAudioBuffer(ctx, decoded) };
  }

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoaded(false);
    setPlaying(false);
    setError("");
    forwardRef.current = null;
    backwardRef.current = null;
    bytesRef.current = null;
    offsetRef.current = 0;
    resumeAfterHold.current = false;
    stopClip();

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error("Could not load the clip");
        const bytes = await res.arrayBuffer();
        if (cancelled) return;
        bytesRef.current = bytes;
        setLoaded(true);
        const ctx = context();
        try {
          const decoded = await buffersFrom(ctx, bytes);
          if (cancelled) return;
          forwardRef.current = decoded.forward;
          backwardRef.current = decoded.backward;
          setReady(true);
        } catch {
          if (cancelled || ctx.state === "suspended") return;
          throw new Error("Could not prepare this clip");
        }
      } catch {
        if (!cancelled) setError("Could not prepare this clip");
      }
    })();

    return () => {
      cancelled = true;
      stopClip();
    };
  }, [src, attempt]);

  useEffect(() => {
    stopClip();
    setPlaying(false);
    offsetRef.current = 0;
    resumeAfterHold.current = false;
  }, [revealed]);

  useEffect(() => {
    if (pausedAt) {
      const clip = clipRef.current;
      if (!clip) return;
      offsetRef.current = clip.position();
      stopClip();
      resumeAfterHold.current = true;
      setPlaying(false);
      return;
    }
    if (!resumeAfterHold.current) return;
    resumeAfterHold.current = false;
    const ctx = ctxRef.current;
    const buffer = revealedRef.current ? forwardRef.current : backwardRef.current;
    if (!ctx || !buffer) return;
    clipRef.current = startClip(ctx, buffer, {
      offset: offsetRef.current,
      rate: 1,
      loop: !revealedRef.current,
      onEnded: () => {
        clipRef.current = null;
        setPlaying(false);
      },
    });
    setPlaying(true);
  }, [pausedAt]);

  useEffect(() => {
    return () => {
      stopClip();
      holdRef.current?.release();
      holdRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  async function handlePlay() {
    if (pausedAt || clipRef.current) return;
    setError("");
    const ctx = context();
    const hold = pokeAudioContext(ctx, holdRef.current);
    holdRef.current = hold;
    try {
      if (ctx.state !== "running") await hold.resumed;
      if (!forwardRef.current && bytesRef.current) {
        const decoded = await buffersFrom(ctx, bytesRef.current);
        forwardRef.current = decoded.forward;
        backwardRef.current = decoded.backward;
        setReady(true);
      }
      const buffer = revealed ? forwardRef.current : backwardRef.current;
      if (!buffer) {
        setError(bytesRef.current ? "Could not prepare this clip" : "Clip is still loading");
        return;
      }
      stopClip();
      clipRef.current = startClip(ctx, buffer, {
        offset: 0,
        rate: 1,
        loop: !revealed,
        onEnded: () => {
          clipRef.current = null;
          setPlaying(false);
        },
      });
      offsetRef.current = 0;
      setPlaying(true);
      if (!revealed && onPlayRequest) await onPlayRequest();
    } catch (err) {
      stopClip();
      setPlaying(false);
      setError(
        err instanceof Error && err.message && !err.message.includes("decode")
          ? err.message
          : "Could not play — check the host volume / browser autoplay"
      );
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
          : !loaded
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
        disabled={!!pausedAt || (!error && (waitingForHost || !loaded))}
        onClick={() => {
          if (error && !ready && !bytesRef.current) {
            setAttempt((n) => n + 1);
            return;
          }
          void handlePlay();
        }}
      >
        {error && !loaded
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
