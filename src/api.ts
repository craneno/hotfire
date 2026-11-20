import type { Progress, Question, QuestionInput, Settings } from "../shared/schema.ts";

export type BankError = { file: string; index: number; message: string };

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

export const api = {
  bank: () => req<{ questions: Question[]; errors: BankError[] }>("GET", "/bank"),
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
