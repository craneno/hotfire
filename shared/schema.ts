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

/** Display/filter hint only. Nothing is auto-checked. */
export const QuestionType = z.enum(["calc", "concept", "interview"]);
export type QuestionType = z.infer<typeof QuestionType>;

export const QuestionInput = z.object({
  /** Optional in bank files; derived from area+prompt if missing. */
  id: z.string().min(1).optional(),
  area: AreaId,
  type: QuestionType.default("concept"),
  title: z.string().min(1),
  topic: z.string().min(1),
  difficulty: Difficulty,
  prompt: z.string().min(1),
  /** Short final answer shown at the top of the solution, e.g. "1.80 mm". Optional. */
  answer: z.string().default(""),
  /** Worked solution or model answer. Empty means not written yet. */
  solution: z.string().default(""),
  /** Points a strong answer hits. Optional. */
  keyPoints: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string()).default([]),
  origin: z.enum(["human", "ai"]).default("human"),
  createdAt: z.string().optional(),
});
export type QuestionInput = z.input<typeof QuestionInput>;
export type QuestionParsed = z.output<typeof QuestionInput>;

/** A question as served to the client: id is resolved and bank status attached. */
export type Question = QuestionParsed & { id: string; verified: boolean };

/* ---------------- Progress ---------------- */

export type SavedAnswer = { at: string; text: string };

export type QuestionProgress = {
  attempts: number;
  lastSeen: string;
  /** Most recent first, capped. */
  answers: SavedAnswer[];
};

export type Settings = {
  focusAreas: AreaId[];
  dailyGoalXp: number;
  sessionLength: number;
  verifiedOnly: boolean;
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

export const DEFAULT_SETTINGS: Settings = {
  focusAreas: ["manufacturing", "stage-prop", "combustion-devices", "battery-pack"],
  dailyGoalXp: 60,
  sessionLength: 10,
  verifiedOnly: false,
};

export const XP_BY_DIFFICULTY: Record<Difficulty, number> = { easy: 10, medium: 20, hard: 30 };
