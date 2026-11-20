import { useState } from "react";
import { AREAS, QuestionInput, type AreaId, type Difficulty, type QuestionType } from "../../shared/schema.ts";
import { TYPE_LABEL } from "./Badges.tsx";

type Draft = {
  id?: string;
  area: AreaId;
  type: QuestionType;
  difficulty: Difficulty;
  title: string;
  topic: string;
  prompt: string;
  answer: string;
  solution: string;
  keyPoints: string;
  tags: string;
  origin: "human" | "ai";
  createdAt?: string;
};

function toDraft(q?: Partial<QuestionInput>): Draft {
  return {
    id: q?.id,
    area: q?.area ?? "manufacturing",
    type: q?.type ?? "concept",
    difficulty: q?.difficulty ?? "medium",
    title: q?.title ?? "",
    topic: q?.topic ?? "",
    prompt: q?.prompt ?? "",
    answer: q?.answer ?? "",
    solution: q?.solution ?? "",
    keyPoints: (q?.keyPoints ?? []).join("\n"),
    tags: (q?.tags ?? []).join(", "),
    origin: q?.origin ?? "human",
    createdAt: q?.createdAt,
  };
}

function fromDraft(d: Draft): unknown {
  return {
    id: d.id,
    area: d.area,
    type: d.type,
    difficulty: d.difficulty,
    title: d.title.trim(),
    topic: d.topic.trim(),
    prompt: d.prompt.trim(),
    answer: d.answer.trim(),
    solution: d.solution.trim(),
    keyPoints: d.keyPoints
      .split("\n")
      .map((r) => r.replace(/^\s*[-*•]\s*/, "").trim())
      .filter(Boolean),
    tags: d.tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
    origin: d.origin,
    createdAt: d.createdAt,
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
      <label>
        Short answer (optional, e.g. “1.80 mm” or “B”)
        <input value={d.answer} onChange={(e) => set("answer", e.target.value)} />
      </label>
      <label>
        Solution (leave empty to have Claude write it later)
        <textarea rows={6} value={d.solution} onChange={(e) => set("solution", e.target.value)} />
      </label>
      <label>
        Key points (optional, one per line)
        <textarea rows={3} value={d.keyPoints} onChange={(e) => set("keyPoints", e.target.value)} />
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
