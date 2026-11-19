import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AREAS, QuestionInput, type AreaId, type Question, type QuestionParsed } from "../shared/schema.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BANK_DIR = path.join(ROOT, "bank");
const DIRS = { verified: path.join(BANK_DIR, "verified"), ai: path.join(BANK_DIR, "ai") } as const;
type Shelf = keyof typeof DIRS;

export type BankError = { file: string; index: number; message: string };

type Located = { q: Question; file: string; shelf: Shelf };

export function resolveId(q: Pick<QuestionParsed, "id" | "area" | "prompt">): string {
  if (q.id) return q.id;
  const short = AREAS.find((a) => a.id === q.area)!.short.toLowerCase();
  const h = createHash("sha1").update(`${q.area}\n${q.prompt.trim()}`).digest("hex").slice(0, 8);
  return `${short}-${h}`;
}

function readArray(file: string): unknown[] {
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("file must contain a JSON array of questions");
  return data;
}

function writeArray(file: string, items: unknown[]) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(items, null, 2) + "\n");
}

/** Reads every bank file fresh, so hand edits to JSON show up on refresh. */
export function loadBank(): { questions: Question[]; errors: BankError[]; located: Map<string, Located> } {
  const errors: BankError[] = [];
  const located = new Map<string, Located>();

  for (const shelf of ["verified", "ai"] as const) {
    const dir = DIRS[shelf];
    fs.mkdirSync(dir, { recursive: true });
    for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const file = path.join(dir, name);
      const rel = path.relative(ROOT, file);
      let items: unknown[];
      try {
        items = readArray(file);
      } catch (e) {
        errors.push({ file: rel, index: -1, message: (e as Error).message });
        continue;
      }
      items.forEach((item, index) => {
        const parsed = QuestionInput.safeParse(item);
        if (!parsed.success) {
          const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
          errors.push({ file: rel, index, message: msg });
          return;
        }
        const id = resolveId(parsed.data);
        if (located.has(id)) {
          errors.push({ file: rel, index, message: `duplicate id ${id} (also in ${located.get(id)!.file})` });
          return;
        }
        located.set(id, { q: { ...parsed.data, id, verified: shelf === "verified" }, file, shelf });
      });
    }
  }
  return { questions: [...located.values()].map((l) => l.q), errors, located };
}

function strip(q: Question): QuestionParsed {
  const { verified: _v, ...rest } = q;
  return rest;
}

function shelfFile(shelf: Shelf, area: AreaId) {
  return path.join(DIRS[shelf], `${area}.json`);
}

function appendTo(file: string, q: QuestionParsed) {
  const items = fs.existsSync(file) ? readArray(file) : [];
  items.push(q);
  writeArray(file, items);
}

/** Remove the entry with this resolved id from its file. */
function removeFrom(file: string, id: string) {
  const items = readArray(file);
  const next = items.filter((item) => {
    const p = QuestionInput.safeParse(item);
    return !(p.success && resolveId(p.data) === id);
  });
  writeArray(file, next);
}

function stamp(input: QuestionInput): QuestionParsed {
  const q = QuestionInput.parse(input);
  return { ...q, id: resolveId(q), createdAt: q.createdAt ?? new Date().toISOString() };
}

export function addQuestions(inputs: QuestionInput[], shelf: Shelf): Question[] {
  const { located } = loadBank();
  const out: Question[] = [];
  for (const input of inputs) {
    const q = stamp(input);
    if (located.has(q.id!)) continue; // exact duplicate prompt already banked
    appendTo(shelfFile(shelf, q.area), q);
    out.push({ ...q, id: q.id!, verified: shelf === "verified" });
  }
  return out;
}

export function updateQuestion(id: string, input: QuestionInput): Question {
  const { located } = loadBank();
  const loc = located.get(id);
  if (!loc) throw new NotFound(id);
  const q = { ...stamp({ ...input, id }), createdAt: loc.q.createdAt };
  const items = readArray(loc.file).map((item) => {
    const p = QuestionInput.safeParse(item);
    return p.success && resolveId(p.data) === id ? q : item;
  });
  writeArray(loc.file, items);
  return { ...q, id, verified: loc.shelf === "verified" };
}

/** Move an AI question into the verified bank (optionally with edits). */
export function approveQuestion(id: string, edited?: QuestionInput): Question {
  const { located } = loadBank();
  const loc = located.get(id);
  if (!loc) throw new NotFound(id);
  if (loc.shelf === "verified") return loc.q;
  const q = edited ? { ...stamp({ ...edited, id }), createdAt: loc.q.createdAt } : strip(loc.q);
  appendTo(shelfFile("verified", q.area), q);
  removeFrom(loc.file, id);
  return { ...q, id, verified: true };
}

export function deleteQuestion(id: string) {
  const { located } = loadBank();
  const loc = located.get(id);
  if (!loc) throw new NotFound(id);
  removeFrom(loc.file, id);
}

export class NotFound extends Error {
  constructor(id: string) {
    super(`question ${id} not found`);
  }
}
