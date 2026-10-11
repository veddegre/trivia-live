import { z } from "zod";
import {
  MAX_BANK_QUESTIONS,
  bankQuestionSchema,
  type BankQuestionInput,
} from "@/lib/question-bank";
import { assertCorrectIndexes } from "@/lib/question-schema";
import { ROUND_TITLE_MAX } from "@/lib/rounds";

export const BANK_PACK_VERSION = 1;
export const MAX_BANK_PACK_BYTES = 1_000_000;

export const bankPackSchema = z.object({
  version: z.literal(BANK_PACK_VERSION).optional().default(BANK_PACK_VERSION),
  title: z.string().min(1).max(ROUND_TITLE_MAX),
  questions: z.array(bankQuestionSchema).min(1).max(MAX_BANK_QUESTIONS),
});

export type BankPack = z.infer<typeof bankPackSchema>;

export type BankPackSource = {
  title: string;
  questions: {
    prompt: string;
    options: string[];
    correctIndex: number;
    timeLimitSec: number;
    basePoints: number;
    timeBonus: number;
    bonus: string;
  }[];
};

const OPTION_KEYS = ["a", "b", "c", "d", "e", "f"] as const;

export function bankToPack(bank: BankPackSource): BankPack {
  return bankPackSchema.parse({
    version: BANK_PACK_VERSION,
    title: bank.title.trim(),
    questions: bank.questions.map((q) => ({
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      timeLimitSec: q.timeLimitSec,
      basePoints: q.basePoints,
      timeBonus: q.timeBonus,
      bonus: q.bonus === "DOUBLE" || q.bonus === "LIGHTNING" ? q.bonus : "NONE",
    })),
  });
}

export function titleFromFilename(filename: string): string {
  const base = filename
    .replace(/^.*[/\\]/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return (base || "Imported bank").slice(0, ROUND_TITLE_MAX);
}

export function parseBankFile(buf: Buffer, filename = ""): BankPack {
  const text = buf.toString("utf8").replace(/^\uFEFF/, "");
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Bank file is empty");
  const pack =
    trimmed.startsWith("{") || trimmed.startsWith("[")
      ? parseBankJson(JSON.parse(safeJson(trimmed)), filename)
      : parseBankCsv(text, filename);
  const indexErr = assertCorrectIndexes(pack.questions);
  if (indexErr) throw new Error("A question's correct answer is out of range");
  return pack;
}

function safeJson(text: string): string {
  try {
    JSON.parse(text);
    return text;
  } catch {
    throw new Error("Not a valid question bank");
  }
}

export function parseBankJson(raw: unknown, filename = ""): BankPack {
  if (Array.isArray(raw)) {
    return finishPack({
      title: titleFromFilename(filename),
      questions: raw,
    });
  }
  if (!raw || typeof raw !== "object") {
    throw new Error("Not a valid question bank");
  }
  if ("gameType" in raw) {
    throw new Error("This is a game pack. Import it from Games.");
  }
  const record = raw as Record<string, unknown>;
  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim()
      : titleFromFilename(filename);
  return finishPack({ ...record, title });
}

function finishPack(raw: unknown): BankPack {
  const parsed = bankPackSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Not a valid question bank");
  return parsed.data;
}

export function parseBankCsv(text: string, filename = ""): BankPack {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error("CSV needs a header and at least one question");
  const header = rows[0].map(columnKey);
  if (!header.includes("prompt")) {
    throw new Error("CSV needs a prompt column");
  }
  const optionSlots = OPTION_KEYS.filter((key) => header.includes(key));
  if (optionSlots.length < 2) {
    throw new Error("CSV needs at least two option columns, A through F");
  }
  if (!header.includes("correct")) {
    throw new Error("CSV needs a correct column");
  }

  const questions: BankQuestionInput[] = [];
  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const value = (key: string) => {
      const at = header.indexOf(key);
      return at >= 0 ? (cells[at] ?? "").trim() : "";
    };
    const prompt = value("prompt");
    if (!prompt && cells.every((cell) => !cell.trim())) return;
    if (!prompt) throw new Error(`Row ${line} needs a prompt`);
    const options = optionSlots.map((key) => value(key)).filter(Boolean);
    if (options.length < 2) {
      throw new Error(`Row ${line} needs at least two options`);
    }
    const correctIndex = resolveCorrect(value("correct"), options);
    if (correctIndex == null) {
      throw new Error(`Row ${line} needs a correct answer`);
    }
    const question: Record<string, unknown> = {
      prompt,
      options,
      correctIndex,
    };
    const time = optionalInt(value("time"), 5, 300);
    if (value("time")) {
      if (time == null) throw new Error(`Row ${line} has a bad timer`);
      question.timeLimitSec = time;
    }
    const base = optionalInt(value("base"), 0, 10000);
    if (value("base")) {
      if (base == null) throw new Error(`Row ${line} has bad base points`);
      question.basePoints = base;
    }
    const speed = optionalInt(value("speed"), 0, 10000);
    if (value("speed")) {
      if (speed == null) throw new Error(`Row ${line} has a bad speed bonus`);
      question.timeBonus = speed;
    }
    if (value("bonus")) question.bonus = bonusValue(value("bonus"));
    questions.push(question as BankQuestionInput);
  });

  if (questions.length < 1) throw new Error("CSV needs at least one question");
  return finishPack({
    title: titleFromFilename(filename),
    questions,
  });
}

function columnKey(header: string): string {
  const key = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (key === "prompt" || key === "question" || key === "q") return "prompt";
  if (["a", "optiona", "option1", "choicea", "choice1"].includes(key)) return "a";
  if (["b", "optionb", "option2", "choiceb", "choice2"].includes(key)) return "b";
  if (["c", "optionc", "option3", "choicec", "choice3"].includes(key)) return "c";
  if (["d", "optiond", "option4", "choiced", "choice4"].includes(key)) return "d";
  if (["e", "optione", "option5", "choicee", "choice5"].includes(key)) return "e";
  if (["f", "optionf", "option6", "choicef", "choice6"].includes(key)) return "f";
  if (["correct", "answer", "correctanswer", "correctindex"].includes(key)) {
    return "correct";
  }
  if (["timelimitsec", "time", "timer", "seconds"].includes(key)) return "time";
  if (["basepoints", "base", "points"].includes(key)) return "base";
  if (["timebonus", "speedbonus", "speed"].includes(key)) return "speed";
  if (key === "bonus") return "bonus";
  return "";
}

function resolveCorrect(raw: string, options: string[]): number | null {
  const text = raw.trim();
  if (!text) return null;
  const byText = options.findIndex(
    (option) => option.localeCompare(text, undefined, { sensitivity: "accent" }) === 0
  );
  if (byText >= 0) return byText;
  const letter = text.toUpperCase();
  if (/^[A-F]$/.test(letter)) {
    const index = letter.charCodeAt(0) - 65;
    return index < options.length ? index : null;
  }
  if (/^\d+$/.test(text)) {
    const n = Number(text);
    if (n >= 1 && n <= options.length) return n - 1;
    if (n >= 0 && n < options.length) return n;
  }
  return null;
}

function optionalInt(raw: string, min: number, max: number): number | null {
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (n < min || n > max) return null;
  return n;
}

function bonusValue(raw: string): "NONE" | "DOUBLE" | "LIGHTNING" {
  const key = raw.trim().toLowerCase();
  if (key === "double" || key === "2x" || key === "doublepoints") return "DOUBLE";
  if (key === "lightning") return "LIGHTNING";
  return "NONE";
}

function parseCsvRows(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const delimiter = csvDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((part) => part.trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((part) => part.trim())) rows.push(row);
  }
  return rows;
}

function csvDelimiter(text: string): "," | ";" {
  const line = text.split(/\r?\n/, 1)[0] ?? "";
  const commas = line.split(",").length;
  const semis = line.split(";").length;
  return semis > commas ? ";" : ",";
}
