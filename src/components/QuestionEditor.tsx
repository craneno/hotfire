import { useState } from "react";
import { AREAS, QuestionInput, type AreaId, type Difficulty, type QuestionType } from "../../shared/schema.ts";
import { TYPE_LABEL } from "./Badges.tsx";

/** Loose editable shape covering every type's fields. */
type Draft = {
  id?: string;
  area: AreaId;
  type: QuestionType;
  difficulty: Difficulty;
  title: string;
  topic: string;
  prompt: string;
  explanation: string;
  tags: string;
  origin: "human" | "ai";
  createdAt?: string;
  choices: string[];
  answerIndex: number;
  answer: string;
  tolerancePct: string;
  unit: string;
  rubric: string;
  modelAnswer: string;
};

function toDraft(q?: Partial<QuestionInput>): Draft {
  const any = (q ?? {}) as Record<string, unknown>;
  return {
    id: q?.id,
    area: q?.area ?? "manufacturing",
    type: q?.type ?? "mcq",
    difficulty: q?.difficulty ?? "medium",
    title: q?.title ?? "",
    topic: q?.topic ?? "",
    prompt: q?.prompt ?? "",
    explanation: q?.explanation ?? "",
    tags: (q?.tags ?? []).join(", "),
    origin: q?.origin ?? "human",
    createdAt: q?.createdAt,
    choices: (any.choices as string[]) ?? ["", "", "", ""],
    answerIndex: (any.answerIndex as number) ?? 0,
    answer: any.answer !== undefined ? String(any.answer) : "",
    tolerancePct: any.tolerancePct !== undefined ? String(any.tolerancePct) : "2",
    unit: (any.unit as string) ?? "",
    rubric: ((any.rubric as string[]) ?? []).join("\n"),
    modelAnswer: (any.modelAnswer as string) ?? "",
  };
}

function fromDraft(d: Draft): unknown {
  const base = {
    id: d.id,
    area: d.area,
    title: d.title.trim(),
    topic: d.topic.trim(),
    difficulty: d.difficulty,
    prompt: d.prompt.trim(),
    explanation: d.explanation.trim(),
    tags: d.tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
    origin: d.origin,
    createdAt: d.createdAt,
  };
  if (d.type === "mcq") {
    const choices = d.choices.map((c) => c.trim());
    const kept = choices.filter(Boolean);
    const answerIndex = kept.indexOf(choices[d.answerIndex]);
    return { ...base, type: "mcq", choices: kept, answerIndex: answerIndex < 0 ? 999 : answerIndex };
  }
  if (d.type === "numeric")
    return {
      ...base,
      type: "numeric",
      answer: d.answer.trim() === "" ? NaN : Number(d.answer),
      tolerancePct: Number(d.tolerancePct || 0),
      unit: d.unit.trim(),
    };
  return {
    ...base,
    type: "open",
    rubric: d.rubric
      .split("\n")
      .map((r) => r.replace(/^\s*[-*•]\s*/, "").trim())
      .filter(Boolean),
    modelAnswer: d.modelAnswer.trim(),
  };
}

export function QuestionEditor({
  initial,
  saveLabel = "Save",
  onSave,
  onCancel,
  note,
}: {
  initial?: Partial<QuestionInput>;
  saveLabel?: string;
  onSave: (q: QuestionInput) => Promise<void> | void;
  onCancel?: () => void;
  note?: string;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function save() {
    const parsed = QuestionInput.safeParse(fromDraft(d));
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => `${i.path.join(".") || "question"}: ${i.message}`));
      return;
    }
    setErrors([]);
    setBusy(true);
    try {
      await onSave(parsed.data);
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="editor">
      {note && <div className="banner info">{note}</div>}
      <div className="row">
        <label>
          Area
          <select value={d.area} onChange={(e) => set("area", e.target.value as AreaId)}>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select value={d.type} onChange={(e) => set("type", e.target.value as QuestionType)}>
            {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Difficulty
          <select value={d.difficulty} onChange={(e) => set("difficulty", e.target.value as Difficulty)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      </div>
      <div className="row">
        <label className="grow">
          Title
          <input value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="Hoop Stress Wall Thickness" />
        </label>
        <label className="grow">
          Topic
          <input value={d.topic} onChange={(e) => set("topic", e.target.value)} placeholder="Pressure vessels" />
        </label>
      </div>
      <label>
        Question
        <textarea rows={5} value={d.prompt} onChange={(e) => set("prompt", e.target.value)} />
      </label>

      {d.type === "mcq" && (
        <fieldset>
          <legend>Choices (select the correct one)</legend>
          {d.choices.map((c, i) => (
            <div className="choice-edit" key={i}>
              <input type="radio" checked={d.answerIndex === i} onChange={() => set("answerIndex", i)} />
              <input
                value={c}
                onChange={(e) => set("choices", d.choices.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`Choice ${i + 1}`}
              />
              {d.choices.length > 2 && (
                <button
                  className="btn small ghost"
                  onClick={() => {
                    set("choices", d.choices.filter((_, j) => j !== i));
                    if (d.answerIndex >= i && d.answerIndex > 0) set("answerIndex", d.answerIndex - 1);
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {d.choices.length < 6 && (
            <button className="btn small ghost" onClick={() => set("choices", [...d.choices, ""])}>
              + choice
            </button>
          )}
        </fieldset>
      )}

      {d.type === "numeric" && (
        <div className="row">
          <label>
            Answer
            <input value={d.answer} onChange={(e) => set("answer", e.target.value)} inputMode="decimal" />
          </label>
          <label>
            Unit
            <input value={d.unit} onChange={(e) => set("unit", e.target.value)} placeholder="MPa" />
          </label>
          <label>
            Tolerance ±%
            <input value={d.tolerancePct} onChange={(e) => set("tolerancePct", e.target.value)} inputMode="decimal" />
          </label>
        </div>
      )}

      {d.type === "open" && (
        <>
          <label>
            Rubric — key points a strong answer hits (one per line)
            <textarea rows={5} value={d.rubric} onChange={(e) => set("rubric", e.target.value)} />
          </label>
          <label>
            Model answer
            <textarea rows={5} value={d.modelAnswer} onChange={(e) => set("modelAnswer", e.target.value)} />
          </label>
        </>
      )}

      <label>
        Explanation (shown after answering)
        <textarea rows={4} value={d.explanation} onChange={(e) => set("explanation", e.target.value)} />
      </label>
      <label>
        Tags (comma-separated)
        <input value={d.tags} onChange={(e) => set("tags", e.target.value)} placeholder="welding, ndt" />
      </label>

      {errors.length > 0 && (
        <div className="banner err">
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}
      <div className="actions">
        <button className="btn primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : saveLabel}
        </button>
        {onCancel && (
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
