# hotfire

Interview drills for mechanical engineers targeting SpaceX-style hardware roles. It's a local app with no AI calls at runtime. AI writes questions and solutions into the bank, and the app shows the user's answer next to the solution. Nothing is graded.

## Writing questions

When asked to generate questions, append them to `bank/ai/<area>.json`. Never write to `bank/verified/`: the user verifies AI questions in the app's Review page, and only that moves them across.

Areas: `manufacturing`, `stage-prop`, `combustion-devices`, `battery-pack`. Each file is a JSON array of:

```json
{
  "area": "combustion-devices",
  "type": "calc",
  "title": "Size the Throat",
  "topic": "Thrust chamber sizing",
  "difficulty": "medium",
  "prompt": "…",
  "answer": "262 mm",
  "solution": "…",
  "keyPoints": [],
  "tags": ["sizing"],
  "origin": "ai"
}
```

- `type`: `calc` (hand calc), `concept` (short conceptual question; options go in the prompt as `A) … B) …`), or `interview` (open-ended: debug an anomaly, defend a tradeoff, walk through a build or test).
- `answer`: the short final answer (`"1.80 mm"`, `"B) …"`). Leave it as `""` for interview questions.
- `solution`: **keep it very concise.** For a calc: the equation, the numbers substituted in, the result, and at most one sentence of insight. For an interview question: about 100 words, first person, how a sharp candidate would say it. No preamble or filler.
- `keyPoints`: interview questions only, 3–6 short points (about 12 words each) that a strong answer hits.
- Omit `id`. It is derived from `area` + `prompt`.

Before you start, read the user's verified questions in that area (`bank/verified/`) and match their style and difficulty. Don't duplicate existing titles in either shelf.

**Accuracy is the priority.** For every calc, compute the answer with a script (e.g. `node -e`) rather than in your head, and put the computed value in both `answer` and `solution`. State every input and assumption in the prompt. Use textbook or public numbers only, never proprietary data.

## Filling in missing solutions

The user may add questions without solutions. `npm run bank:check` lists any question with an empty `solution`. Fill those in place with the same rules: concise, calcs computed with a script. Keep the user's question text exactly as written, unless a clear error makes it unanswerable. In that case, tell the user instead of changing it.

## Always

Run `npm run bank:check` (validates every file) and `npm run typecheck` before committing.
