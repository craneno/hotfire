import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  AREAS,
  Difficulty,
  QuestionInput,
  QuestionType,
  type AreaId,
  type GenerateRequest,
  type GradeResult,
  type Question,
} from "../shared/schema.ts";

const MODEL = process.env.HOTFIRE_MODEL ?? "claude-opus-5-5";

let client: Anthropic | null = null;
function getClient() {
  // Resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / `ant auth login` profile.
  client ??= new Anthropic();
  return client;
}

export class AiError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

/* -------- Shared prompt context -------- */

const AREA_SCOPE: Record<AreaId, string> = {
  manufacturing:
    "welding (TIG, MIG, friction stir, laser, EB) and weld defects; NDT (RT/CT, UT/PAUT, PT, MT, leak, proof); GD&T and tolerance stacks; machining, sheet metal, forming, composites, additive (LPBF/DED) and post-processing; heat treatment; fasteners, preload, torque-tension; fixturing and tooling; DFM/DFA; inspection and CMM; nonconformance/MRB, root cause and corrective action; production rate, yield and bottlenecks; aerospace alloys (Al-Li, 2xxx/6xxx Al, 300-series stainless, Inconel 718/625, Ti-6Al-4V).",
  "stage-prop":
    "propellant tanks and domes; pressurization (helium/COPV, autogenous, ullage collapse); feed lines, ducts, bellows, gimbal joints; valves (ball, butterfly, poppet, check, relief), regulators, actuators; fluid flow (orifices, Cv, line losses, Joukowsky water hammer); pump inlet conditions, NPSP and cavitation; pogo; slosh and baffles; cryogenics (chill-down, boil-off, geysering, thermal contraction, densified propellants); leak checks and seals; GSE and quick disconnects; stage-level integration and acceptance testing.",
  "combustion-devices":
    "thrust chamber and nozzle design (expansion ratio, flow separation, contour); c*, Cf, Isp, mixture ratio and their relationships; injector types (impinging, coax swirl, pintle), injector ΔP and stiffness; combustion instability (chug, buzz, acoustic modes, Rayleigh criterion, baffles, acoustic cavities); ignition (spark/torch, TEA-TEB, hypergols); regenerative, film, transpiration and ablative cooling, Bartz heat flux, coolant ΔT and ΔP; engine cycles (pressure-fed, gas generator, staged combustion ORSC/FRSC, full-flow, expander); preburners and turbine inlet temperature; materials (copper alloys, Inconel, oxidizer compatibility); hot-fire test anomalies and data review.",
  "battery-pack":
    "cell chemistry and format selection (NMC, NCA, LFP; cylindrical, prismatic, pouch); series/parallel architecture, voltage and capacity sizing; busbars, interconnects, laser welds and wire bonds, fusing; I²R heating and thermal management (cold plates, coolant, interface materials); thermal runaway, propagation barriers and venting; BMS (cell balancing, SoC/SoH estimation, contactors, precharge, isolation monitoring); HV safety; structural design (vibration, shock, potting, enclosure); aging and degradation (lithium plating, calendar/cycle); pack test and qualification; pack manufacturing.",
};

const AUTHOR_SYSTEM = `You write interview practice questions for mechanical engineers preparing for hardware roles at fast-moving launch-vehicle and spacecraft companies (SpaceX-style interviews: first-principles reasoning, hand calcs on a whiteboard, responsible-engineer ownership, build-test-fly-iterate, anomaly investigations).

Question types:
- "numeric": a hand calc with a single unambiguous answer. Give every value and constant needed in the prompt and state simplifying assumptions. Work the problem carefully, then re-check the arithmetic before writing "answer". Put the full derivation with intermediate numbers in "explanation". "unit" is the unit the answer is expressed in, and the prompt must ask for that unit. "tolerancePct" is usually 1-3; use larger only when reasonable rounding of inputs justifies it, and 0 only for integer counts.
- "mcq": exactly 4 choices, one clearly correct; distractors should be misconceptions a real candidate might hold, not throwaways. Vary which position is correct. "answerIndex" is 0-based.
- "open": the kind of question an interviewer asks out loud: debug an anomaly, defend a design tradeoff, walk through how you'd build or test something. "rubric" lists 4-7 concrete, checkable points a strong answer hits. "modelAnswer" is what a strong candidate would say in about two minutes, written in first person and plain language.

Every question: "title" is a short LeetCode-style name (2-6 words). "topic" is a short sub-topic label. "explanation" teaches the underlying principle, not just the answer. "tags" are 1-4 lowercase keywords.

Fields that don't apply to a question's type: use [] for arrays, null for numbers, "" for strings.

Accuracy is the priority. Use textbook and public-domain numbers; never invent proprietary data about specific companies or vehicles. If a question can't be made unambiguous, write a different one.`;

/* -------- Flat schema for structured output, normalized after -------- */

const GenQuestion = z.object({
  title: z.string(),
  topic: z.string(),
  difficulty: Difficulty,
  type: QuestionType,
  prompt: z.string(),
  explanation: z.string(),
  tags: z.array(z.string()),
  choices: z.array(z.string()),
  answerIndex: z.number().nullable(),
  answer: z.number().nullable(),
  tolerancePct: z.number().nullable(),
  unit: z.string(),
  rubric: z.array(z.string()),
  modelAnswer: z.string(),
});
type GenQuestion = z.infer<typeof GenQuestion>;

function normalize(g: GenQuestion, area: AreaId, origin: "human" | "ai") {
  const base = {
    area,
    origin,
    title: g.title.trim(),
    topic: g.topic.trim(),
    difficulty: g.difficulty,
    prompt: g.prompt.trim(),
    explanation: g.explanation.trim(),
    tags: g.tags,
  };
  const candidate =
    g.type === "mcq"
      ? { ...base, type: "mcq", choices: g.choices, answerIndex: g.answerIndex }
      : g.type === "numeric"
        ? { ...base, type: "numeric", answer: g.answer, tolerancePct: g.tolerancePct ?? 2, unit: g.unit }
        : { ...base, type: "open", rubric: g.rubric, modelAnswer: g.modelAnswer };
  return QuestionInput.safeParse(candidate);
}

/** Strip a question down to what an author needs to see as a style example. */
function exemplar(q: Question) {
  const { id: _i, verified: _v, createdAt: _c, origin: _o, ...rest } = q;
  return rest;
}

type ParsedOrThrow<T> = { parsed_output: T | null; stop_reason: string | null; stop_details?: unknown };

function unwrap<T>(msg: ParsedOrThrow<T>): T {
  if (msg.stop_reason === "refusal") throw new AiError("The model declined this request.", 422);
  if (msg.stop_reason === "max_tokens") throw new AiError("Response was cut off (max_tokens). Try fewer questions.");
  if (!msg.parsed_output) throw new AiError("Model returned output that didn't match the schema.");
  return msg.parsed_output;
}

async function call<T>(opts: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  effort: "low" | "medium" | "high";
}): Promise<T> {
  try {
    const stream = getClient().beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    return unwrap(await stream.finalMessage());
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw new AiError("Anthropic credentials missing or invalid. Set ANTHROPIC_API_KEY in .env.", 401);
    if (e instanceof Anthropic.RateLimitError) throw new AiError("Rate limited by the Anthropic API. Retry shortly.", 429);
    if (e instanceof Anthropic.APIError) throw new AiError(`Anthropic API error ${e.status}: ${e.message}`);
    // Thrown by the client constructor/request when no credential can be resolved.
    if (e instanceof Anthropic.AnthropicError)
      throw new AiError(`AI unavailable: ${e.message}. Set ANTHROPIC_API_KEY in .env.`, 401);
    throw e;
  }
}

/* -------- Generate -------- */

export async function generateQuestions(req: GenerateRequest, bank: Question[]) {
  const area = AREAS.find((a) => a.id === req.area)!;
  const inArea = bank.filter((q) => q.area === req.area);
  // The user's own verified questions set the bar for style and difficulty.
  const examples = [
    ...inArea.filter((q) => q.verified && q.origin === "human"),
    ...inArea.filter((q) => q.verified && q.origin === "ai"),
  ].slice(0, 12);

  const user = [
    `Write ${req.count} new question(s) for the focus area "${area.label}".`,
    `Area scope: ${AREA_SCOPE[req.area]}`,
    req.topic ? `Concentrate on this topic: ${req.topic}` : "Spread across the area scope; favor what interviewers actually probe.",
    `Difficulty: ${req.difficulty === "mixed" ? "a mix of easy, medium and hard" : req.difficulty}.`,
    `Allowed types: ${req.types.join(", ")}. Mix them when more than one is allowed.`,
    examples.length
      ? `Questions from the candidate's verified bank. Match their style, depth and difficulty calibration:\n${JSON.stringify(examples.map(exemplar), null, 1)}`
      : "",
    inArea.length
      ? `Already in the bank (do not duplicate these, and don't write close variants):\n${inArea.map((q) => `- ${q.title}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const out = await call({
    system: AUTHOR_SYSTEM,
    user,
    schema: z.object({ questions: z.array(GenQuestion) }),
    effort: "high",
  });

  const ok: QuestionInput[] = [];
  const rejected: string[] = [];
  for (const g of out.questions) {
    if (!req.types.includes(g.type)) {
      rejected.push(`${g.title}: type ${g.type} not requested`);
      continue;
    }
    const r = normalize(g, req.area, "ai");
    if (r.success) ok.push(r.data);
    else rejected.push(`${g.title}: ${r.error.issues.map((i) => i.message).join("; ")}`);
  }
  return { questions: ok, rejected };
}

/* -------- Import from free text -------- */

const IMPORT_SYSTEM = `${AUTHOR_SYSTEM}

You are now converting a candidate's own notes into structured questions. Rules:
- Keep the candidate's wording of each question; only fix obvious typos. Do not add questions they didn't write.
- If they gave an answer, keep it as the answer. Fill in anything missing (choices, rubric, model answer, explanation, unit, tolerance) yourself, and in "inferred" say briefly which fields you filled or any doubt about their answer. Use "" when nothing was inferred.
- Pick the type that best fits: numeric if it has a single computed answer, mcq if they listed options, otherwise open.
- "area" is the best-fit focus area for each question.`;

export async function importQuestions(text: string, defaultArea: AreaId | null) {
  const out = await call({
    system: IMPORT_SYSTEM,
    user: [
      `Focus areas: ${AREAS.map((a) => `${a.id} (${a.label})`).join(", ")}.`,
      defaultArea ? `Unless clearly another area, use "${defaultArea}".` : "",
      `Candidate's notes:\n<notes>\n${text}\n</notes>`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    schema: z.object({
      questions: z.array(GenQuestion.extend({ area: z.enum(AREAS.map((a) => a.id) as [AreaId, ...AreaId[]]), inferred: z.string() })),
    }),
    effort: "medium",
  });

  const drafts: { question: QuestionInput; inferred: string }[] = [];
  const rejected: string[] = [];
  for (const g of out.questions) {
    const r = normalize(g, g.area, "human");
    if (r.success) drafts.push({ question: r.data, inferred: g.inferred });
    else rejected.push(`${g.title}: ${r.error.issues.map((i) => i.message).join("; ")}`);
  }
  return { drafts, rejected };
}

/* -------- Grade open answers -------- */

const GRADER_SYSTEM = `You grade a candidate's answer to a mechanical engineering interview question for a SpaceX-style hardware role. The candidate typed the answer quickly, as if speaking in an interview, so judge substance, not polish.

Grade against the rubric. Credit correct reasoning that reaches a rubric point in different words. Penalize physics or engineering claims that are wrong, especially when stated confidently; an interviewer would. Don't credit vague hand-waving ("I'd look into it") as hitting a specific point.

score is 0-100. verdict: "correct" for 75+, "partial" for 40-74, "wrong" below 40. hits and misses quote rubric points (shortened is fine). feedback is 2-4 sentences addressed to the candidate: what was strong, the most important gap, and any incorrect claim. followUp is the next question a sharp interviewer would ask given this answer.`;

const Grade = z.object({
  score: z.number(),
  verdict: z.enum(["correct", "partial", "wrong"]),
  hits: z.array(z.string()),
  misses: z.array(z.string()),
  feedback: z.string(),
  followUp: z.string(),
});

export async function gradeOpenAnswer(q: Question, answer: string): Promise<GradeResult & { followUp: string }> {
  if (q.type !== "open") throw new AiError("Only open questions are AI-graded.", 400);
  const g = await call({
    system: GRADER_SYSTEM,
    user: [
      `Question:\n${q.prompt}`,
      `Rubric:\n${q.rubric.map((r) => `- ${r}`).join("\n")}`,
      `Reference answer:\n${q.modelAnswer}`,
      `Candidate's answer:\n<answer>\n${answer}\n</answer>`,
    ].join("\n\n"),
    schema: Grade,
    effort: "medium",
  });
  const score = Math.max(0, Math.min(100, Math.round(g.score)));
  return { ...g, score };
}
