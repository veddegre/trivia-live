"use client";

import { useMemo, useState } from "react";
import { emptyQuestion, type DraftQuestion } from "@/components/QuestionEditor";
import {
  draftQuestionFromBank,
  padDraftOptions,
} from "@/lib/question-bank";
import { isQuestionBonus } from "@/lib/scoring";

export type PickerBank = {
  id: string;
  title: string;
  questions: Array<{
    prompt: string;
    options: string[];
    correctIndex: number;
    timeLimitSec: number;
    basePoints: number;
    timeBonus: number;
    bonus?: string;
  }>;
};

function toDraft(
  q: PickerBank["questions"][number],
  bankTitle: string
): DraftQuestion {
  const input = draftQuestionFromBank(
    {
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      timeLimitSec: q.timeLimitSec,
      basePoints: q.basePoints,
      timeBonus: q.timeBonus,
      bonus: isQuestionBonus(q.bonus) ? q.bonus : "NONE",
    },
    bankTitle
  );
  return {
    ...emptyQuestion("TRIVIA"),
    prompt: input.prompt,
    options: padDraftOptions(input.options),
    correctIndex: input.correctIndex,
    timeLimitSec: input.timeLimitSec,
    basePoints: input.basePoints,
    timeBonus: input.timeBonus,
    bonus: isQuestionBonus(input.bonus) ? input.bonus : "NONE",
    roundTitle: input.roundTitle ?? bankTitle,
  };
}

type Props = {
  banks: PickerBank[];
  onAdd: (questions: DraftQuestion[]) => void;
  onClose: () => void;
};

export function BankPicker({ banks, onAdd, onClose }: Props) {
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const bank = useMemo(
    () => banks.find((b) => b.id === bankId) ?? banks[0],
    [banks, bankId]
  );

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function addSelected() {
    if (!bank) return;
    const drafts = [...selected]
      .sort((a, b) => a - b)
      .map((i) => bank.questions[i])
      .filter(Boolean)
      .map((q) => toDraft(q, bank.title));
    if (drafts.length === 0) return;
    onAdd(drafts);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bank-picker-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(36rem,85dvh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2
            id="bank-picker-title"
            className="text-sm font-bold uppercase tracking-[0.16em] text-amber"
          >
            Add from bank
          </h2>
          <button
            type="button"
            className="text-sm font-semibold text-muted hover:text-chalk"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {banks.length === 0 ? (
            <p className="text-sm text-muted">
              No banks yet. Open the Banks tab to create one or add the starter
              pack.
            </p>
          ) : (
            <>
              <label className="block space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
                  Bank
                </span>
                <select
                  className="field"
                  value={bank?.id ?? ""}
                  onChange={(e) => {
                    setBankId(e.target.value);
                    setSelected(new Set());
                  }}
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({b.questions.length})
                    </option>
                  ))}
                </select>
              </label>
              <ul className="mt-4 space-y-2">
                {bank?.questions.map((q, i) => {
                  const on = selected.has(i);
                  return (
                    <li key={`${bank.id}-${i}`}>
                      <label
                        className="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3"
                        style={
                          on
                            ? {
                                borderColor: "var(--amber)",
                                background:
                                  "color-mix(in srgb, var(--amber) 10%, var(--panel))",
                              }
                            : {
                                borderColor: "var(--line)",
                                background: "var(--panel)",
                              }
                        }
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-[var(--amber)]"
                          checked={on}
                          onChange={() => toggle(i)}
                        />
                        <span className="text-sm text-chalk">{q.prompt}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-line px-5 py-4">
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm font-bold"
            style={{ borderColor: "var(--line)", color: "var(--chalk)" }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!bank || selected.size === 0}
            onClick={addSelected}
          >
            Add {selected.size || ""}{" "}
            {selected.size === 1 ? "question" : "questions"}
          </button>
        </div>
      </div>
    </div>
  );
}
