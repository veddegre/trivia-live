"use client";

import { useEffect, useRef, useState } from "react";
import { playbackRate } from "@/lib/audio-speed";

type Props = {
  src: string;
  startSpeed?: number;
  openedAt?: string | null;
  timeLimitSec?: number | null;
  revealed?: boolean;
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
  onPlayRequest,
  className = "",
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
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
      audio.playbackRate = startSpeed;
      setRateLabel(startSpeed);
      return;
    }

    const opened = new Date(openedAt).getTime();
    const limit = timeLimitSec ?? 30;
    let raf = 0;
    const tick = () => {
      const rate = playbackRate({
        startSpeed,
        elapsedMs: Date.now() - opened,
        timeLimitSec: limit,
      });
      audio.playbackRate = rate;
      setRateLabel(rate);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [src, startSpeed, openedAt, timeLimitSec, revealed, playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);
    setError("");
  }, [src]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  async function handlePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    setError("");
    try {
      if (onPlayRequest) await onPlayRequest();
      audio.playbackRate = revealed ? 1 : startSpeed;
      await audio.play();
      setPlaying(true);
    } catch {
      setError("Could not play — check the host volume / browser autoplay");
      setPlaying(false);
    }
  }

  async function handleReplay() {
    const audio = audioRef.current;
    if (!audio) return;
    setError("");
    try {
      audio.playbackRate = 1;
      audio.currentTime = 0;
      await audio.play();
      setPlaying(true);
    } catch {
      setError("Could not play");
      setPlaying(false);
    }
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-line bg-ink-2/70 px-6 py-8 ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onEnded={() => setPlaying(false)}
      />
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber">
        {revealed ? "Full speed" : `${rateLabel.toFixed(2)}×`}
      </div>
      <p className="mt-2 text-center text-sm text-muted">
        {revealed
          ? "Replay the snippet at normal speed"
          : playing
            ? "Listening…"
            : "Tap play to start the snippet and the timer"}
      </p>
      <button
        type="button"
        className="btn mt-5 px-10 uppercase tracking-wide"
        onClick={() => void (revealed ? handleReplay() : handlePlay())}
      >
        {revealed ? "Replay" : playing ? "Playing…" : "Play snippet"}
      </button>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
    </div>
  );
}
