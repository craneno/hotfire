import { DEFAULT_SETTINGS, XP_BY_DIFFICULTY, type Progress, type Question } from "./schema.ts";

const MAX_SAVED_ANSWERS = 5;

export function emptyProgress(): Progress {
  return { xp: 0, daily: {}, streak: 0, bestStreak: 0, lastActiveDay: null, questions: {}, settings: { ...DEFAULT_SETTINGS } };
}

export function dayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000);
}

/** A streak survives until the end of the day after the last active day. */
export function liveStreak(p: Progress, today = dayKey()): number {
  if (!p.lastActiveDay) return 0;
  return daysBetween(p.lastActiveDay, today) <= 1 ? p.streak : 0;
}

export const isDone = (p: Progress, id: string) => (p.questions[id]?.attempts ?? 0) > 0;

/** Pure: records a finished question (and the answer typed, if any). */
export function applyDone(
  prev: Progress,
  q: Pick<Question, "id" | "difficulty">,
  answer: string,
  now = new Date(),
): { progress: Progress; xpGained: number } {
  const today = dayKey(now);
  const old = prev.questions[q.id];
  const answers = answer.trim()
    ? [{ at: now.toISOString(), text: answer.trim() }, ...(old?.answers ?? [])].slice(0, MAX_SAVED_ANSWERS)
    : (old?.answers ?? []);

  let streak = prev.streak;
  if (prev.lastActiveDay !== today) {
    const gap = prev.lastActiveDay ? daysBetween(prev.lastActiveDay, today) : Infinity;
    streak = gap === 1 ? prev.streak + 1 : 1;
  }

  const xpGained = XP_BY_DIFFICULTY[q.difficulty];
  return {
    xpGained,
    progress: {
      ...prev,
      xp: prev.xp + xpGained,
      daily: { ...prev.daily, [today]: (prev.daily[today] ?? 0) + xpGained },
      streak,
      bestStreak: Math.max(prev.bestStreak, streak),
      lastActiveDay: today,
      questions: { ...prev.questions, [q.id]: { attempts: (old?.attempts ?? 0) + 1, lastSeen: now.toISOString(), answers } },
    },
  };
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
 * Build a session: unseen questions first, interleaved across areas and starting with the
 * area you've done the least of; then the ones you haven't touched in the longest time.
 */
export function buildSession(pool: Question[], p: Progress, length: number): Question[] {
  const doneIn = new Map<string, number>();
  for (const q of pool) doneIn.set(q.area, (doneIn.get(q.area) ?? 0) + (isDone(p, q.id) ? 1 : 0));

  const byArea = new Map<string, Question[]>();
  const unseen = shuffle(pool.filter((q) => !isDone(p, q.id))).sort(
    (a, b) => (doneIn.get(a.area) ?? 0) - (doneIn.get(b.area) ?? 0),
  );
  for (const q of unseen) byArea.set(q.area, [...(byArea.get(q.area) ?? []), q]);
  const interleaved: Question[] = [];
  while ([...byArea.values()].some((l) => l.length))
    for (const list of byArea.values()) {
      const q = list.shift();
      if (q) interleaved.push(q);
    }

  const stale = pool
    .filter((q) => isDone(p, q.id))
    .sort((a, b) => p.questions[a.id].lastSeen.localeCompare(p.questions[b.id].lastSeen));

  return [...interleaved, ...stale].slice(0, length);
}
