// Validates every bank file and prints counts. Exits non-zero on any invalid entry.
import { loadBank } from "../server/bank.ts";
import { AREAS } from "../shared/schema.ts";

const { questions, errors } = loadBank();
for (const a of AREAS) {
  const qs = questions.filter((q) => q.area === a.id);
  const v = qs.filter((q) => q.verified).length;
  console.log(`${a.label.padEnd(24)} ${String(v).padStart(4)} verified  ${String(qs.length - v).padStart(4)} AI pending`);
}
if (errors.length) {
  console.error(`\n${errors.length} invalid entr${errors.length === 1 ? "y" : "ies"}:`);
  for (const e of errors) console.error(`  ${e.file}${e.index >= 0 ? `[${e.index}]` : ""}: ${e.message}`);
  process.exit(1);
}
console.log(`\nOK: ${questions.length} questions`);
