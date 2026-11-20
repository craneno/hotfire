import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS, type Progress } from "../shared/schema.ts";
import { emptyProgress } from "../shared/session.ts";

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "progress.json");

export function loadProgress(): Progress {
  try {
    const p = JSON.parse(fs.readFileSync(FILE, "utf8")) as Progress;
    // Tolerate entries written by older versions.
    const questions: Progress["questions"] = {};
    for (const [id, q] of Object.entries(p.questions ?? {}))
      questions[id] = { attempts: q.attempts ?? 0, lastSeen: q.lastSeen ?? new Date(0).toISOString(), answers: q.answers ?? [] };
    return { ...emptyProgress(), ...p, questions, settings: { ...DEFAULT_SETTINGS, ...p.settings } };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(p, null, 2));
  fs.renameSync(tmp, FILE);
}
