import { DEFAULT_SETTINGS, type Progress, type Question, type QuestionInput, type Settings } from "../shared/schema.ts";
import { applyDone, emptyProgress, normalizeProgress } from "../shared/session.ts";

export type BankError = { file: string; index: number; message: string };
type BankResponse = { questions: Question[]; errors: BankError[] };

/** Hosted (GitHub Pages) build: read-only bank, progress kept in this browser. */
export const readOnly = import.meta.env.VITE_STATIC === "true";

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText}`);
  return data as T;
}

const serverApi = {
  bank: () => req<BankResponse>("GET", "/bank"),
  addQuestions: (questions: QuestionInput[]) => req<{ added: Question[] }>("POST", "/bank", { questions }),
  updateQuestion: (id: string, q: QuestionInput) => req<{ question: Question }>("PUT", `/bank/${id}`, q),
  approve: (id: string, edited?: QuestionInput) => req<{ question: Question }>("POST", `/bank/${id}/approve`, edited ?? {}),
  remove: (id: string) => req<{ ok: true }>("DELETE", `/bank/${id}`),

  progress: () => req<Progress>("GET", "/progress"),
  done: (questionId: string, answer: string) =>
    req<{ progress: Progress; xpGained: number }>("POST", "/attempt", { questionId, answer }),
  settings: (s: Partial<Settings>) => req<Progress>("PUT", "/settings", s),
  resetProgress: () => req<Progress>("POST", "/progress/reset"),
};

/* ---------- static (hosted) implementation ---------- */

const KEY = "hotfire.progress.v1";
let cachedBank: Question[] = [];

function readLocal(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeProgress(JSON.parse(raw)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

function writeLocal(p: Progress): Progress {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode or storage blocked: progress lasts for this page view only */
  }
  return p;
}

const readOnlyError = () => Promise.reject(new Error("The hosted version is read-only. Edit questions locally."));

const staticApi: typeof serverApi = {
  bank: async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}bank.json`);
    if (!res.ok) throw new Error(`bank.json ${res.status}`);
    const questions = (await res.json()) as Question[];
    cachedBank = questions;
    return { questions, errors: [] };
  },
  addQuestions: readOnlyError,
  updateQuestion: readOnlyError,
  approve: readOnlyError,
  remove: readOnlyError,

  progress: async () => readLocal(),
  done: async (questionId, answer) => {
    const q = cachedBank.find((x) => x.id === questionId);
    if (!q) throw new Error(`question ${questionId} not found`);
    const { progress, xpGained } = applyDone(readLocal(), q, answer);
    return { progress: writeLocal(progress), xpGained };
  },
  settings: async (s) => {
    const p = readLocal();
    return writeLocal({ ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings, ...s } });
  },
  resetProgress: async () => writeLocal({ ...emptyProgress(), settings: readLocal().settings }),
};

export const api = readOnly ? staticApi : serverApi;
