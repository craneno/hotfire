# hotfire 🔥

Interview drills for mechanical engineers going after SpaceX-style hardware roles. It mixes Duolingo-style daily sessions (streaks, XP, daily goal) with a LeetCode-style problem list.

Focus areas: **Manufacturing / Build**, **Stage Propulsion**, **Combustion Devices**, **Battery Pack**, **Core Fundamentals**.

Nothing is graded. You write your answer, click **Done**, and see your answer next to the solution. The app runs fully offline with no API calls. AI is used only to write questions and solutions into the bank ahead of time.

## Run it

```bash
npm install
npm run dev     # API on :8787, app on http://localhost:5173
```

`npm run start` builds the app and serves everything from :8787 as a single process.

## The question bank

```
bank/
  verified/   your questions, plus AI questions you've approved   ← source of truth
  ai/         AI-written questions waiting for review
data/
  progress.json   XP, streak, completion and your past answers (gitignored)
```

Each file is a JSON array; see `CLAUDE.md` for the format. The server re-reads the files on every request, so edits show up on refresh. Run `npm run bank:check` to validate everything and list questions that are still missing a solution.

**Adding your questions:** use the **Add** page, or edit `bank/verified/*.json` directly. You can leave the solution blank.

**AI questions and solutions:** open a Claude Code session on this repo and ask, e.g. "generate 5 hard stage-prop questions on pressurization" or "fill in the missing solutions". `CLAUDE.md` tells it the format, to keep solutions concise, and to compute every hand calc rather than guess. Generated questions land in `bank/ai/` marked **AI · unreviewed**, and you verify or reject them in **Review** or right after answering one. Turn on **Verified questions only** on Home to practice only your bank.

The repo ships with 28 starter questions (7 per area) in `bank/ai/`.

## How practice works

- **Session:** questions you haven't done yet come first, mixed across your focus areas and starting with the area you've done least. After that come the ones you've gone longest without seeing.
- **Answering:** type your answer, or work it on paper and click **Done** with an empty box. The solution appears next to what you wrote, and each attempt is saved so you can compare against your previous answers next time.
- **XP:** 10 / 20 / 30 for easy / medium / hard. Any day where you earn XP counts toward your streak.

Keyboard: `Ctrl/Cmd+Enter` = Done.

## Stack

Vite + React + TypeScript frontend, Express API (`server/`) that reads and writes the JSON bank, shared zod schema and session logic (`shared/`).
