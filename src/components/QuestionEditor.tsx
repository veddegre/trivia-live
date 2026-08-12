"use client";

import {
  SCORE_BASE_DEFAULT,
  SCORE_TIME_BONUS_DEFAULT,
} from "@/lib/types";

export type DraftQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  timeLimitSec: number;
  basePoints: number;
  timeBonus: number;
};

export function emptyQuestion(): DraftQuestion {
  return {
    prompt: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    timeLimitSec: 30,
    basePoints: SCORE_BASE_DEFAULT,
    timeBonus: SCORE_TIME_BONUS_DEFAULT,
  };
}

type Props = {
  question: DraftQuestion;
  index: number;
  canRemove: boolean;
  onChange: (next: DraftQuestion) => void;
  onRemove: () => void;
  /** Optional late-join control shown on the first question (game-level setting) */
  allowLateJoin?: boolean;
  onAllowLateJoinChange?: (next: boolean) => void;
};

export function QuestionEditor({
  question: q,
  index: qi,
  canRemove,
  onChange,
  onRemove,
  allowLateJoin,
  onAllowLateJoinChange,
}: Props) {
  function setOption(oi: number, value: string) {
    const options = [...q.options];
    options[oi] = value;
    onChange({ ...q, options });
  }

  function addOption() {
    if (q.options.length >= 6) return;
    onChange({ ...q, options: [...q.options, ""] });
  }

  function removeOption(oi: number) {
    if (q.options.length <= 2) return;
    const options = q.options.filter((_, i) => i !== oi);
    const correctIndex =
      q.correctIndex >= options.length
        ? options.length - 1
        : q.correctIndex > oi
          ? q.correctIndex - 1
          : q.correctIndex === oi
            ? 0
            : q.correctIndex;
    onChange({ ...q, options, correctIndex });
  }

  function makeTrueFalse() {
    onChange({
      ...q,
      options: ["True", "False"],
      correctIndex: Math.min(q.correctIndex, 1),
    });
  }

  return (
    <div
      className="rounded-2xl border border-line bg-panel p-5 md:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
          Question {qi + 1}
        </div>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            className="text-sm font-semibold text-amber"
            onClick={makeTrueFalse}
          >
            True / False
          </button>
          {canRemove && (
            <button
              type="button"
              className="text-sm font-semibold text-amber"
              onClick={onRemove}
            >
              Remove question
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
              Question prompt
            </span>
            <textarea
              className="field min-h-[96px] resize-y"
              placeholder="Enter your question…"
              value={q.prompt}
              onChange={(e) => onChange({ ...q, prompt: e.target.value })}
            />
          </label>

          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
              Options
            </div>
            <div className="mt-2 space-y-2">
              {q.options.map((opt, oi) => (
                <label key={oi} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`correct-${qi}`}
                    checked={q.correctIndex === oi}
                    onChange={() => onChange({ ...q, correctIndex: oi })}
                    className="h-4 w-4 accent-[var(--amber)]"
                  />
                  <input
                    className="field"
                    placeholder={
                      oi === q.correctIndex
                        ? `Option ${oi + 1} (correct answer)`
                        : `Option ${oi + 1}`
                    }
                    value={opt}
                    onChange={(e) => setOption(oi, e.target.value)}
                  />
                  {q.options.length > 2 && (
                    <button
                      type="button"
                      className="shrink-0 text-xs text-muted"
                      onClick={() => removeOption(oi)}
                      aria-label={`Remove option ${oi + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </label>
              ))}
            </div>
            {q.options.length < 6 && (
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-amber"
                onClick={addOption}
              >
                + Add option
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
              Timer
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[15, 30, 60].map((sec) => {
                const on = q.timeLimitSec === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    className="rounded-full px-3 py-1.5 text-sm font-bold"
                    style={
                      on
                        ? { background: "var(--amber)", color: "#ffffff" }
                        : {
                            background: "transparent",
                            color: "var(--amber)",
                            border: "1px solid color-mix(in srgb, var(--amber) 45%, var(--line))",
                          }
                    }
                    onClick={() => onChange({ ...q, timeLimitSec: sec })}
                  >
                    {sec}s
                  </button>
                );
              })}
              <input
                type="number"
                min={5}
                max={300}
                className="field w-20"
                value={q.timeLimitSec}
                onChange={(e) =>
                  onChange({ ...q, timeLimitSec: Number(e.target.value) || 30 })
                }
              />
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
              Base points
            </span>
            <input
              type="number"
              min={0}
              max={10000}
              className="field"
              value={q.basePoints}
              onChange={(e) =>
                onChange({ ...q, basePoints: Number(e.target.value) || 0 })
              }
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
              Speed bonus (max points)
            </span>
            <input
              type="number"
              min={0}
              max={10000}
              className="field"
              value={q.timeBonus}
              onChange={(e) =>
                onChange({ ...q, timeBonus: Number(e.target.value) || 0 })
              }
            />
          </label>

          {qi === 0 && onAllowLateJoinChange && (
            <label className="flex items-start gap-3 pt-1">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[var(--amber)]"
                checked={!!allowLateJoin}
                onChange={(e) => onAllowLateJoinChange(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-amber">
                  Allow late joins
                </span>
                <span className="text-xs text-muted">
                  Players can join after the game has started.
                </span>
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
