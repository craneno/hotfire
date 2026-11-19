import { z } from "zod";

export const AREAS = [
  { id: "manufacturing", label: "Manufacturing / Build", short: "MFG", emoji: "🛠️" },
  { id: "stage-prop", label: "Stage Propulsion", short: "PROP", emoji: "🛢️" },
  { id: "combustion-devices", label: "Combustion Devices", short: "CD", emoji: "🔥" },
  { id: "battery-pack", label: "Battery Pack", short: "BATT", emoji: "🔋" },
] as const;

export const AreaId = z.enum(["manufacturing", "stage-prop", "combustion-devices", "battery-pack"]);
export type AreaId = z.infer<typeof AreaId>;

export const Difficulty = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof Difficulty>;

export const QuestionType = z.enum(["mcq", "numeric", "open"]);
export type QuestionType = z.infer<typeof QuestionType>;

const Base = z.object({
  /** Optional in bank files; derived from area+prompt if missing. */
  id: z.string().min(1).optional(),
  area: AreaId,
  title: z.string().min(1),
  topic: z.string().min(1),
  difficulty: Difficulty,
  prompt: z.string().min(1),
  /** Shown after answering. Explain the why, not just the answer. */
  explanation: z.string().default(""),
  tags: z.array(z.string()).default([]),
  origin: z.enum(["human", "ai"]).default("human"),
  createdAt: z.string().optional(),
});

export const McqQuestion = Base.extend({
  type: z.literal("mcq"),
  choices: z.array(z.string().min(1)).min(2),
  answerIndex: z.number().int().min(0),
}).refine((q) => q.answerIndex < q.choices.length, { message: "answerIndex out of range" });

export const NumericQuestion = Base.extend({
  type: z.literal("numeric"),
  answer: z.number(),
  /** Accepted relative error in percent. 0 means exact. */
  tolerancePct: z.number().min(0).default(2),
  unit: z.string().default(""),
});

export const OpenQuestion = Base.extend({
  type: z.literal("open"),
  /** Key points a strong answer hits. Used by the AI grader and for self-grading. */
  rubric: z.array(z.string().min(1)).min(1),
  modelAnswer: z.string().min(1),
});

export const QuestionInput = z.discriminatedUnion("type", [McqQuestion, NumericQuestion, OpenQuestion]);
export type QuestionInput = z.input<typeof QuestionInput>;
export type QuestionParsed = z.output<typeof QuestionInput>;

/** A question as served to the client: id is resolved and bank status attached. */
export type Question = QuestionParsed & { id: string; verified: boolean };

/* ---------------- Progress / spaced repetition ---------------- */

export type QuestionProgress = {
  attempts: number;
  correct: number;
  /** Leitner box 0..5. Higher = better known. */
  box: number;
  lastSeen: string;
  dueAt: string;
  lastResult: "correct" | "partial" | "wrong";
};

export type Progress = {
  xp: number;
  /** yyyy-mm-dd -> xp earned that day */
  daily: Record<string, number>;
  streak: number;
  bestStreak: number;
  lastActiveDay: string | null;
  questions: Record<string, QuestionProgress>;
  settings: Settings;
};

export type Settings = {
  focusAreas: AreaId[];
  dailyGoalXp: number;
  sessionLength: number;
  verifiedOnly: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  focusAreas: ["manufacturing", "stage-prop", "combustion-devices", "battery-pack"],
  dailyGoalXp: 60,
  sessionLength: 10,
  verifiedOnly: false,
};

export const XP_BY_DIFFICULTY: Record<Difficulty, number> = { easy: 10, medium: 20, hard: 30 };

/* ---------------- AI payloads ---------------- */

export type GradeResult = {
  score: number;
  verdict: "correct" | "partial" | "wrong";
  hits: string[];
  misses: string[];
  feedback: string;
};

export type GenerateRequest = {
  area: AreaId;
  count: number;
  difficulty: Difficulty | "mixed";
  types: QuestionType[];
  topic?: string;
};
