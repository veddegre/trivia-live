"use client";

import { useEffect, useRef, useState } from "react";
import { playbackRate } from "@/lib/audio-speed";
import { holdPlaybackSession } from "@/lib/audio-output";
import { visualNowMs } from "@/lib/question-clock";

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
  const audioRef = useRef<HTMLAudioElement>(null);
  const resumeAfterHold = useRef(false);
  const wantPlay = useRef(false);
  const pausedAtRef = useRef(pausedAt);
  const clockOffsetRef = useRef(clockOffsetMs);
  const appliedRate = useRef<number | null>(null);
  const lastKick = useRef(0);
  const [playing, setPlaying] = useState(false);
  pausedAtRef.current = pausedAt;
  clockOffsetRef.current = clockOffsetMs;
  const [error, setError] = useState("");
  const [rateLabel, setRateLabel] = useState(revealed ? 1 : startSpeed);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (revealed) {
      audio.playbackRate = 1;
      setRateLabel(1);
      return;
    }

    if (!openedAt || !playing) {
      if (audio.paused) {
        audio.playbackRate = startSpeed;
        setRateLabel(startSpeed);
      }
      return;
    }

    const opened = new Date(openedAt).getTime();
    const limit = timeLimitSec ?? 30;
    const apply = (rate: number) => {
      const next = Math.round(rate * 100) / 100;
      if (appliedRate.current === next) return;
      appliedRate.current = next;
      audio.playbackRate = next;
      setRateLabel(next);
    };
    apply(
      playbackRate({
        startSpeed,
        elapsedMs: visualNowMs(Date.now(), clockOffsetRef.current, pausedAt) - opened,
        timeLimitSec: limit,
      })
    );
    // Safari stalls if playbackRate is rewritten every frame.
    const id = window.setInterval(() => {
      if (pausedAtRef.current) return;
      apply(
        playbackRate({
          startSpeed,
          elapsedMs:
            visualNowMs(Date.now(), clockOffsetRef.current, pausedAtRef.current) - opened,
          timeLimitSec: limit,
        })
      );
    }, 200);
    return () => window.clearInterval(id);
  }, [src, startSpeed, openedAt, timeLimitSec, revealed, playing, pausedAt]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (pausedAt) {
      if (!audio.paused) {
        audio.pause();
        resumeAfterHold.current = true;
      }
      return;
    }
    if (!resumeAfterHold.current) return;
    resumeAfterHold.current = false;
    void audio.play().catch(() => setPlaying(false));
  }, [pausedAt, playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    wantPlay.current = false;
    appliedRate.current = null;
    audio.pause();
    audio.currentTime = 0;
    resumeAfterHold.current = false;
    setPlaying(false);
    setError("");
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  async function handlePlay() {
    const audio = audioRef.current;
    if (!audio || pausedAt) return;
    setError("");
    holdPlaybackSession();
    audio.playbackRate = revealed ? 1 : startSpeed;
    wantPlay.current = true;
    const started = audio.play();
    try {
      if (onPlayRequest) await onPlayRequest();
    } catch (err) {
      wantPlay.current = false;
      audio.pause();
      setPlaying(false);
      setError(err instanceof Error ? err.message : "Could not start the timer");
      return;
    }
    try {
      await started;
      setPlaying(true);
    } catch {
      wantPlay.current = false;
      setError("Could not play — check the host volume / browser autoplay");
      setPlaying(false);
    }
  }

  async function handleReplay() {
    const audio = audioRef.current;
    if (!audio) return;
    setError("");
    holdPlaybackSession();
    audio.playbackRate = 1;
    audio.currentTime = 0;
    wantPlay.current = true;
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      wantPlay.current = false;
      setError("Could not play");
      setPlaying(false);
    }
  }

  function resumeIfInterrupted() {
    const audio = audioRef.current;
    if (!audio || !wantPlay.current || pausedAtRef.current || audio.ended) return;
    const now = Date.now();
    if (now - lastKick.current < 400) return;
    lastKick.current = now;
    void audio.play().catch(() => {
      wantPlay.current = false;
      setPlaying(false);
    });
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-line bg-ink-2/70 px-6 py-8 ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        playsInline
        onEnded={() => {
          wantPlay.current = false;
          setPlaying(false);
        }}
        onPause={resumeIfInterrupted}
      />
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber">
        {revealed ? "Full speed" : `${rateLabel.toFixed(2)}×`}
      </div>
      <p className="mt-2 text-center text-sm text-muted">
        {revealed
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
        disabled={!!pausedAt || (!revealed && !openedAt && !onPlayRequest)}
        onClick={() => void (revealed ? handleReplay() : handlePlay())}
      >
        {revealed ? "Replay" : pausedAt ? "Paused" : playing ? "Playing…" : "Play snippet"}
      </button>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
    </div>
  );
}
