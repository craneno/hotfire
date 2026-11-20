import type {
  AreaId,
  GenerateRequest,
  GradeResult,
  Progress,
  Question,
  QuestionInput,
  QuestionProgress,
  Settings,
} from "../shared/schema.ts";

export type AiStatus = { provider: "google" | "anthropic"; model: string; configured: boolean };

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
  attempt: (questionId: string, result: QuestionProgress["lastResult"]) =>
    req<{ progress: Progress; xpGained: number }>("POST", "/attempt", { questionId, result }),
  settings: (s: Partial<Settings>) => req<Progress>("PUT", "/settings", s),
  resetProgress: () => req<Progress>("POST", "/progress/reset"),

  aiStatus: () => req<AiStatus>("GET", "/ai/status"),
  generate: (r: GenerateRequest) => req<{ added: Question[]; rejected: string[] }>("POST", "/ai/generate", r),
  grade: (questionId: string, answer: string) =>
    req<GradeResult & { followUp: string }>("POST", "/ai/grade", { questionId, answer }),
  importText: (text: string, area: AreaId | null) =>
    req<{ drafts: { question: QuestionInput; inferred: string }[]; rejected: string[] }>("POST", "/ai/import", {
      text,
      area,
    }),
};
