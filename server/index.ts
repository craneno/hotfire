import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AreaId, DEFAULT_SETTINGS, QuestionInput } from "../shared/schema.ts";
import { applyDone, emptyProgress } from "../shared/session.ts";
import { addQuestions, approveQuestion, deleteQuestion, loadBank, NotFound, updateQuestion } from "./bank.ts";
import { loadProgress, saveProgress } from "./progress.ts";

const app = express();
app.use(express.json({ limit: "2mb" }));
const api = express.Router();

api.get("/bank", (_req, res) => {
  const { questions, errors } = loadBank();
  res.json({ questions, errors });
});

api.post("/bank", (req, res) => {
  const body = z.object({ questions: z.array(QuestionInput) }).parse(req.body);
  res.json({ added: addQuestions(body.questions, "verified") });
});

api.put("/bank/:id", (req, res) => {
  res.json({ question: updateQuestion(req.params.id as string, QuestionInput.parse(req.body)) });
});

api.post("/bank/:id/approve", (req, res) => {
  const edited = req.body && Object.keys(req.body).length ? QuestionInput.parse(req.body) : undefined;
  res.json({ question: approveQuestion(req.params.id as string, edited) });
});

api.delete("/bank/:id", (req, res) => {
  deleteQuestion(req.params.id as string);
  res.json({ ok: true });
});

api.get("/progress", (_req, res) => {
  res.json(loadProgress());
});

/** Mark a question done and save what you wrote. Nothing is graded. */
api.post("/attempt", (req, res) => {
  const body = z.object({ questionId: z.string(), answer: z.string().max(20000) }).parse(req.body);
  const q = loadBank().questions.find((x) => x.id === body.questionId);
  if (!q) throw new NotFound(body.questionId);
  const { progress, xpGained } = applyDone(loadProgress(), q, body.answer);
  saveProgress(progress);
  res.json({ progress, xpGained });
});

api.put("/settings", (req, res) => {
  const s = z
    .object({
      focusAreas: z.array(AreaId).min(1),
      dailyGoalXp: z.number().int().min(10).max(1000),
      sessionLength: z.number().int().min(3).max(50),
      verifiedOnly: z.boolean(),
    })
    .partial()
    .parse(req.body);
  const p = loadProgress();
  p.settings = { ...DEFAULT_SETTINGS, ...p.settings, ...s };
  saveProgress(p);
  res.json(p);
});

api.post("/progress/reset", (_req, res) => {
  saveProgress({ ...emptyProgress(), settings: loadProgress().settings });
  res.json(loadProgress());
});

app.use("/api", api);

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
  } else if (err instanceof NotFound) {
    res.status(404).json({ error: err.message });
  } else {
    console.error(err);
    res.status(500).json({ error: (err as Error).message ?? "internal error" });
  }
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  const prod = process.env.NODE_ENV === "production";
  console.log(`hotfire api on http://localhost:${port}${prod ? "" : "  (open the web app at http://localhost:5173)"}`);
});
