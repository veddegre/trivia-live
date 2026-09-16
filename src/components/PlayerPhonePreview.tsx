"use client";

import { useEffect } from "react";
import { CountdownTimer } from "@/components/CountdownTimer";
import type { GameType } from "@/lib/types";
import { gameTypeUsesImage } from "@/lib/types";
import { questionBonusLabel, type QuestionBonus } from "@/lib/scoring";
import { answerLetterInk } from "@/lib/answer-ink";

type Props = {
  prompt: string;
  options: string[];
  timeLimitSec: number;
  gameType: GameType;
  roundLabel?: string;
  questionLabel: string;
  bonus?: QuestionBonus;
  onClose: () => void;
};

/** Phone-shaped preview of what players see (no media, no correct answer). */
export function PlayerPhonePreview({
  prompt,
  options,
  timeLimitSec,
  gameType,
  roundLabel,
  questionLabel,
  bonus,
  onClose,
}: Props) {
  const visible = options.map((opt) => opt.trim()).filter(Boolean);
  const timer = Math.max(1, timeLimitSec || 30);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-preview-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="player-preview-title"
            className="text-sm font-bold uppercase tracking-[0.16em] text-amber"
          >
            As a player
          </h2>
          <button
            type="button"
            className="text-sm font-semibold text-muted hover:text-chalk"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="overflow-hidden rounded-[2rem] border-2 border-line bg-ink px-5 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <p className="text-center text-sm text-muted">
            {roundLabel || questionLabel}
          </p>
          {questionBonusLabel(bonus) ? (
            <p className="mt-2 text-center text-[11px] font-extrabold uppercase tracking-[0.16em] text-amber">
              {questionBonusLabel(bonus)}
            </p>
          ) : null}
          <div className="mt-4">
            <CountdownTimer remainingSec={timer} totalSec={timer} size="md" />
          </div>
          <h3 className="display mt-6 text-center text-[1.45rem] leading-snug text-chalk">
            {prompt.trim() || "Question prompt"}
          </h3>
          {gameTypeUsesImage(gameType) && (
            <p className="mt-2 text-center text-sm text-muted">
              Watch the host screen
            </p>
          )}
          {gameType === "AUDIO_SPEED" && (
            <p className="mt-2 text-center text-sm text-muted">
              Listen on the host speakers
            </p>
          )}
          <div className="mt-7 grid gap-3">
            {(visible.length > 0 ? visible : ["Option A", "Option B"]).map(
              (opt, i) => (
                <div
                  key={`${i}-${opt}`}
                  className="flex min-h-[3.5rem] w-full items-center gap-3.5 rounded-2xl border border-line bg-panel px-4 py-4 text-left text-[19px] font-semibold leading-snug text-chalk"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-extrabold"
                    style={{
                      background: answerLetterInk(i).bg,
                      color: answerLetterInk(i).fg,
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{opt}</span>
                </div>
              )
            )}
          </div>
          <p className="mt-6 text-center text-xs text-muted">
            Phones never show the photo, clip, or correct answer
          </p>
        </div>
      </div>
    </div>
  );
}
