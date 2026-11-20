import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Progress } from "../shared/schema.ts";
import { emptyProgress, normalizeProgress } from "../shared/session.ts";

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "progress.json");

export function loadProgress(): Progress {
  try {
    return normalizeProgress(JSON.parse(fs.readFileSync(FILE, "utf8")));
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
