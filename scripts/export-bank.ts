// Writes the resolved question bank to a JSON file for the static (GitHub Pages) build.
// Fails the build if any bank entry is invalid, so a broken file never deploys.
import fs from "node:fs";
import { loadBank } from "../server/bank.ts";

const out = process.argv[2] ?? "dist/bank.json";
const { questions, errors } = loadBank();
if (errors.length) {
  for (const e of errors) console.error(`${e.file}${e.index >= 0 ? `[${e.index}]` : ""}: ${e.message}`);
  process.exit(1);
}
fs.writeFileSync(out, JSON.stringify(questions));
console.log(`wrote ${questions.length} questions to ${out}`);
