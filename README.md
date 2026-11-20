# hotfire 🔥

Interview drills for mechanical engineers going after SpaceX-style hardware roles. It mixes Duolingo-style daily sessions (streaks, XP, spaced repetition) with a LeetCode-style problem list.

Focus areas: **Manufacturing / Build**, **Stage Propulsion**, **Combustion Devices**, **Battery Pack**.

Question types:

- **Hand calc**: numeric answer with a unit and a ± tolerance
- **Multiple choice**
- **Interview answer**: open-ended. You type the answer you'd give out loud, then either the AI model grades it against a rubric (score, what you hit and missed, and the follow-up an interviewer would ask) or you self-grade against the model answer.

## Run it

```bash
npm install
cp .env.example .env    # add GEMINI_API_KEY to turn on the AI features
npm run dev             # API on :8787, app on http://localhost:5173
```

Everything except generation, import and AI grading works without an API key.

## The question bank

```
bank/
  verified/   your questions, plus AI questions you've approved   ← source of truth
  ai/         AI-generated questions waiting for review
data/
  progress.json   XP, streak, per-question spaced-repetition state (gitignored)
```

Each file is a JSON array. File names don't matter (`<area>.json` is the convention), so organize however you like. The server re-reads files on every request, so edits show up on refresh. Run `npm run bank:check` to validate everything.

### Adding your questions

There are three ways to add questions, all of which land in `bank/verified/`:

1. **Add → Write one**: a form for a single question.
2. **Add → Import from notes**: paste questions in any format (doc, list, interview notes). the AI model structures them, keeps your wording, fills in missing answers, rubrics and explanations, and flags what it inferred. You review each draft before it's saved.
3. **Edit the JSON** directly:

```jsonc
// common fields
{
  "area": "combustion-devices",        // manufacturing | stage-prop | combustion-devices | battery-pack
  "type": "numeric",                   // numeric | mcq | open
  "title": "Size the Throat",
  "topic": "Thrust chamber sizing",
  "difficulty": "medium",              // easy | medium | hard
  "prompt": "…",
  "explanation": "…",                  // shown after answering
  "tags": ["sizing"],                  // optional
  "origin": "human"                    // optional, default human
  // "id" is optional; it's derived from area + prompt if you leave it out
}

// numeric
{ "answer": 262.2, "unit": "mm", "tolerancePct": 2 }

// mcq
{ "choices": ["…", "…", "…", "…"], "answerIndex": 2 }

// open
{ "rubric": ["point a strong answer hits", "…"], "modelAnswer": "…" }
```

### AI questions

**Generate** asks the AI model for new questions in an area. You can set a topic, difficulty, types and count. Your verified questions in that area are sent as style and difficulty examples, and existing titles are sent so it avoids duplicates. The more of your own questions you add, the better calibrated the output gets.

Generated questions go to `bank/ai/` and are playable right away, marked **AI · unreviewed**. You can verify or reject them from **Review**, or straight from the answer screen while you practice. Turn on **Verified questions only** on Home to practice only your bank.

The repo ships with 28 starter questions (7 per area) in `bank/ai/`. They're AI-written, so they start unreviewed.

## How practice works

- **Session**: due reviews first, then unseen questions, interleaved across areas and biased toward your weakest area. A question you miss comes back once at the end of the session.
- **Spaced repetition**: Leitner boxes. A correct answer pushes the next review out by 1 → 3 → 7 → 16 → 35 days. A partial answer drops one box. A miss resets the question to box 0.
- **XP**: 10 / 20 / 30 for easy / medium / hard, half for partial. Any day where you earn XP counts toward your streak.
- **Mastered** means the question has reached box 3, i.e. you've answered it correctly across about a week of gaps.

Keyboard: `1`–`4` pick a choice, `Enter` checks or continues.

## Stack

Vite + React + TypeScript frontend, Express API (`server/`), shared zod schema and SRS logic (`shared/`).

## AI provider

The AI features run on **Google Gemini 4 Neon** by default. Switch providers in `.env`:

| `AI_PROVIDER` | Key | Model var (default) |
|---|---|---|
| `google` (default) | `GEMINI_API_KEY` | `GEMINI_MODEL` (`gemini-4-neon`; `gemini-4-hydrogen` is lighter and cheaper) |
| `anthropic` | `ANTHROPIC_API_KEY` | `CLAUDE_MODEL` (`claude-opus-5-5`) |

Both providers return JSON against the same schema (`server/llm.ts`), and their output is validated before anything is written to the bank. Every prompt tells the model to keep explanations, model answers and feedback very concise (the `CONCISE` block in `server/ai.ts`).

`npm run start` builds the app and serves everything from :8787 if you'd rather run a single process.
