"use client";

import { useEffect, useRef, useState } from "react";
import { playbackRate } from "@/lib/audio-speed";
import { visualNowMs } from "@/lib/question-clock";
import {
  decodeAudioBuffer,
  pokeAudioContext,
  startClip,
  type ArmedContext,
  type LiveClip,
} from "@/lib/web-audio-clip";

type Props = {
  src: string;
  startSpeed?: number;
  openedAt?: string | null;
  timeLimitSec?: number | null;
  revealed?: boolean;
  /** Subtract from Date.now() so a fast or slow device tracks the server clock. */
  clockOffsetMs?: number;
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

export function SpeedRevealAudio({
  src,
  startSpeed = 2,
  openedAt,
  timeLimitSec,
  revealed = false,
  clockOffsetMs = 0,
  pausedAt = null,
  onPlayRequest,
  className = "",
}: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const clipRef = useRef<LiveClip | null>(null);
  const holdRef = useRef<ArmedContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const bytesRef = useRef<ArrayBuffer | null>(null);
  const offsetRef = useRef(0);
  const resumeAfterHold = useRef(false);
  const pausedAtRef = useRef(pausedAt);
  const clockOffsetRef = useRef(clockOffsetMs);
  const openedAtRef = useRef(openedAt);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [rateLabel, setRateLabel] = useState(revealed ? 1 : startSpeed);
  pausedAtRef.current = pausedAt;
  clockOffsetRef.current = clockOffsetMs;
  openedAtRef.current = openedAt;

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

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setPlaying(false);
    setError("");
    bufferRef.current = null;
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
          const decoded = await decodeAudioBuffer(ctx, bytes);
          if (cancelled) return;
          bufferRef.current = decoded;
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
    const opened = openedAt ? new Date(openedAt).getTime() : 0;
    const limit = timeLimitSec ?? 30;
    if (revealed || !openedAt || !playing || pausedAt) return;
    const apply = () => {
      const clip = clipRef.current;
      if (!clip || pausedAtRef.current) return;
      const rate = playbackRate({
        startSpeed,
        elapsedMs: visualNowMs(Date.now(), clockOffsetRef.current, pausedAtRef.current) - opened,
        timeLimitSec: limit,
      });
      clip.setRate(rate);
      const shown = Math.round(rate * 100) / 100;
      setRateLabel((prev) => (prev === shown ? prev : shown));
    };
    apply();
    const id = window.setInterval(apply, 250);
    return () => window.clearInterval(id);
  }, [startSpeed, openedAt, timeLimitSec, revealed, playing, pausedAt]);

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
    const buffer = bufferRef.current;
    const ctx = ctxRef.current;
    if (!buffer || !ctx) return;
    const opened = openedAtRef.current ? new Date(openedAtRef.current).getTime() : 0;
    const rate = revealed
      ? 1
      : playbackRate({
          startSpeed,
          elapsedMs: opened
            ? visualNowMs(Date.now(), clockOffsetRef.current, null) - opened
            : 0,
          timeLimitSec: timeLimitSec ?? 30,
        });
    clipRef.current = startClip(ctx, buffer, {
      offset: offsetRef.current,
      rate,
      loop: false,
      onEnded: () => {
        clipRef.current = null;
        setPlaying(false);
      },
    });
    setPlaying(true);
    setRateLabel(Math.round(rate * 100) / 100);
  }, [pausedAt, revealed, startSpeed, timeLimitSec]);

  useEffect(() => {
    return () => {
      stopClip();
      holdRef.current?.release();
      holdRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  async function ensureBuffer(ctx: AudioContext) {
    if (bufferRef.current) return bufferRef.current;
    if (!bytesRef.current) return null;
    const decoded = await decodeAudioBuffer(ctx, bytesRef.current);
    bufferRef.current = decoded;
    return decoded;
  }

  async function handlePlay() {
    if (pausedAt || clipRef.current) return;
    setError("");
    const ctx = context();
    // resume() has to be called in this tap. Safari drops a clip started
    // while the context is still suspended, so wait for that before start.
    const hold = pokeAudioContext(ctx, holdRef.current);
    holdRef.current = hold;
    try {
      if (ctx.state !== "running") await hold.resumed;
      const buffer = await ensureBuffer(ctx);
      if (!buffer) {
        setError(bytesRef.current ? "Could not prepare this clip" : "Clip is still loading");
        return;
      }
      const rate = revealed ? 1 : startSpeed;
      stopClip();
      clipRef.current = startClip(ctx, buffer, {
        offset: 0,
        rate,
        loop: false,
        onEnded: () => {
          clipRef.current = null;
          setPlaying(false);
        },
      });
      offsetRef.current = 0;
      setPlaying(true);
      setRateLabel(Math.round(rate * 100) / 100);
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
        {revealed ? "Full speed" : `${rateLabel.toFixed(2)}×`}
      </div>
      <p className="mt-2 text-center text-sm text-muted">
        {error
          ? error
          : !loaded
            ? "Preparing clip…"
            : revealed
              ? "Replay the snippet at normal speed"
              : pausedAt
                ? "Paused"
                : playing
                  ? "Listening…"
                  : onPlayRequest
                    ? "Tap play to start the snippet and the timer"
                    : openedAt
                      ? "Tap play to listen on this screen"
                      : "Waiting for the host to play"}
      </p>
      <button
        type="button"
        className="btn mt-5 px-10 uppercase tracking-wide"
        disabled={!!pausedAt || (!error && (waitingForHost || !loaded))}
        onClick={() => {
          if (error && !bufferRef.current && !bytesRef.current) {
            setAttempt((n) => n + 1);
            return;
          }
          void handlePlay();
        }}
      >
        {error && !loaded
          ? "Try again"
          : revealed
            ? "Replay"
            : pausedAt
              ? "Paused"
              : playing
                ? "Playing…"
                : "Play snippet"}
      </button>
    </div>
  );
}
