import {
  DEFAULT_SETTINGS,
  XP_BY_DIFFICULTY,
  type Progress,
  type Question,
  type QuestionProgress,
} from "./schema.ts";

/** Days until next review for each Leitner box after a correct answer. */
const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 16, 35];
const MAX_BOX = BOX_INTERVAL_DAYS.length - 1;
const RETRY_MINUTES = 10;

export function emptyProgress(): Progress {
  return {
    xp: 0,
    daily: {},
    streak: 0,
    bestStreak: 0,
    lastActiveDay: null,
    questions: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

/** Streak as displayed: a streak survives until the end of the day after the last active day. */
export function liveStreak(p: Progress, today = dayKey()): number {
  if (!p.lastActiveDay) return 0;
  return daysBetween(p.lastActiveDay, today) <= 1 ? p.streak : 0;
}

export function xpFor(q: Pick<Question, "difficulty">, result: QuestionProgress["lastResult"]): number {
  const base = XP_BY_DIFFICULTY[q.difficulty];
  if (result === "correct") return base;
  if (result === "partial") return Math.round(base / 2);
  return 2; // showing up counts for something
}

/** Pure: returns a new Progress with the attempt applied. */
export function applyAttempt(
  prev: Progress,
  q: Pick<Question, "id" | "difficulty">,
  result: QuestionProgress["lastResult"],
  now = new Date(),
): { progress: Progress; xpGained: number } {
  const today = dayKey(now);
  const old = prev.questions[q.id];
  const box = old?.box ?? 0;

  let nextBox: number;
  let due: Date;
  if (result === "correct") {
    nextBox = Math.min(box + 1, MAX_BOX);
    due = new Date(now.getTime() + BOX_INTERVAL_DAYS[nextBox] * 86_400_000);
  } else if (result === "partial") {
    nextBox = Math.max(box - 1, 0);
    due = new Date(now.getTime() + 86_400_000);
  } else {
    nextBox = 0;
    due = new Date(now.getTime() + RETRY_MINUTES * 60_000);
  }

  const qp: QuestionProgress = {
    attempts: (old?.attempts ?? 0) + 1,
    correct: (old?.correct ?? 0) + (result === "correct" ? 1 : 0),
    box: nextBox,
    lastSeen: now.toISOString(),
    dueAt: due.toISOString(),
    lastResult: result,
  };

  let streak = prev.streak;
  if (prev.lastActiveDay !== today) {
    const gap = prev.lastActiveDay ? daysBetween(prev.lastActiveDay, today) : Infinity;
    streak = gap === 1 ? prev.streak + 1 : 1;
  }

  const xpGained = xpFor(q, result);
  return {
    xpGained,
    progress: {
      ...prev,
      xp: prev.xp + xpGained,
      daily: { ...prev.daily, [today]: (prev.daily[today] ?? 0) + xpGained },
      streak,
      bestStreak: Math.max(prev.bestStreak, streak),
      lastActiveDay: today,
      questions: { ...prev.questions, [q.id]: qp },
    },
  };
}

export function isDue(p: Progress, id: string, now = new Date()): boolean {
  const qp = p.questions[id];
  return !!qp && new Date(qp.dueAt).getTime() <= now.getTime();
}

/** Mastered = reached box 3+ (survived a ~week-long gap). */
export function isMastered(p: Progress, id: string): boolean {
  return (p.questions[id]?.box ?? 0) >= 3;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a practice session: due reviews first (most overdue first), then unseen
 * questions biased toward the weakest focus area, then anything not yet mastered.
 */
export function buildSession(pool: Question[], p: Progress, length: number, now = new Date()): Question[] {
  const due = pool
    .filter((q) => isDue(p, q.id, now))
    .sort((a, b) => p.questions[a.id].dueAt.localeCompare(p.questions[b.id].dueAt));

  const areaMastery = new Map<string, number>();
  for (const q of pool) {
    const cur = areaMastery.get(q.area) ?? 0;
    areaMastery.set(q.area, cur + (isMastered(p, q.id) ? 1 : 0));
  }
  const unseen = shuffle(pool.filter((q) => !p.questions[q.id])).sort(
    (a, b) => (areaMastery.get(a.area) ?? 0) - (areaMastery.get(b.area) ?? 0),
  );
  // Interleave areas among unseen so a session isn't all one topic.
  const byArea = new Map<string, Question[]>();
  for (const q of unseen) byArea.set(q.area, [...(byArea.get(q.area) ?? []), q]);
  const interleaved: Question[] = [];
  while ([...byArea.values()].some((l) => l.length)) {
    for (const list of byArea.values()) {
      const q = list.shift();
      if (q) interleaved.push(q);
    }
  }

  const rest = shuffle(pool.filter((q) => p.questions[q.id] && !isDue(p, q.id, now) && !isMastered(p, q.id)));

  const picked: Question[] = [];
  const seen = new Set<string>();
  for (const q of [...due, ...interleaved, ...rest]) {
    if (picked.length >= length) break;
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    picked.push(q);
  }
  return picked;
}

/** Numeric grading with relative tolerance; handles answer = 0 via absolute epsilon. */
export function checkNumeric(given: number, answer: number, tolerancePct: number): boolean {
  if (!Number.isFinite(given)) return false;
  if (answer === 0) return Math.abs(given) <= Math.max(tolerancePct / 100, 1e-9);
  return Math.abs(given - answer) / Math.abs(answer) <= tolerancePct / 100 + 1e-12;
}
