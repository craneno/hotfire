import { useState } from "react";
import { AREAS, type AreaId, type Question } from "../../shared/schema.ts";
import { api } from "../api.ts";
import { useStore } from "../App.tsx";
import { AreaBadge, DiffBadge, TYPE_LABEL } from "../components/Badges.tsx";
import { QuestionEditor } from "../components/QuestionEditor.tsx";

export function ReviewPage() {
  const { bank } = useStore();
  const [area, setArea] = useState<AreaId | "all">("all");
  const pending = bank.filter((q) => !q.verified && (area === "all" || q.area === area));

  return (
    <div className="review">
      <h1>Review AI questions</h1>
      <p className="muted">
        Check the answer and reasoning. Verify to move a question into your bank, edit it first if it's close, or reject it.
        Only verified questions are used as style examples for future generation.
      </p>
      <div className="filters">
        <select value={area} onChange={(e) => setArea(e.target.value as AreaId | "all")}>
          <option value="all">All areas</option>
          {AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <span className="muted small">{pending.length} pending</span>
      </div>
      {pending.length === 0 && <p className="muted center">Queue is empty.</p>}
      {pending.map((q) => (
        <ReviewItem key={q.id} q={q} />
      ))}
    </div>
  );
}

function ReviewItem({ q }: { q: Question }) {
  const { reloadBank } = useStore();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reloadBank();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="review-item">
      <div className="qmeta">
        <AreaBadge area={q.area} />
        <DiffBadge d={q.difficulty} />
        <span className="muted small">
          {TYPE_LABEL[q.type]} · {q.topic}
        </span>
      </div>
      {editing ? (
        <QuestionEditor
          initial={q}
          saveLabel="Save & verify"
          onSave={(edited) => act(() => api.approve(q.id, edited))}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <h3>{q.title}</h3>
          <div className="qprompt">{q.prompt}</div>
          <div className="key">
            {q.type === "mcq" && (
              <ol className="choices-key">
                {q.choices.map((c, i) => (
                  <li key={i} className={i === q.answerIndex ? "right" : ""}>
                    {c}
                  </li>
                ))}
              </ol>
            )}
            {q.type === "numeric" && (
              <p>
                Answer: <strong>{q.answer} {q.unit}</strong> <span className="muted">(±{q.tolerancePct}%)</span>
              </p>
            )}
            {q.type === "open" && (
              <>
                <h4>Rubric</h4>
                <ul className="rubric">
                  {q.rubric.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                <h4>Model answer</h4>
                <p className="pre">{q.modelAnswer}</p>
              </>
            )}
            {q.explanation && (
              <>
                <h4>Explanation</h4>
                <p className="pre">{q.explanation}</p>
              </>
            )}
          </div>
          {error && <div className="banner err">{error}</div>}
          <div className="actions">
            <button className="btn good" disabled={busy} onClick={() => act(() => api.approve(q.id))}>
              ✓ Verify
            </button>
            <button className="btn" disabled={busy} onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="btn bad" disabled={busy} onClick={() => act(() => api.remove(q.id))}>
              ✕ Reject
            </button>
          </div>
        </>
      )}
    </div>
  );
}
