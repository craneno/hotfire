import { useState } from "react";
import { AREAS, type AreaId, type Question } from "../../shared/schema.ts";
import { api } from "../api.ts";
import { useStore } from "../App.tsx";
import { AreaBadge, DiffBadge, TYPE_LABEL } from "../components/Badges.tsx";
import { QuestionEditor } from "../components/QuestionEditor.tsx";
import { Solution } from "../components/Solution.tsx";

export function ReviewPage() {
  const { bank } = useStore();
  const [area, setArea] = useState<AreaId | "all">("all");
  const pending = bank.filter((q) => !q.verified && (area === "all" || q.area === area));

  return (
    <div className="review">
      <h1>Review AI questions</h1>
      <p className="muted">
        AI-written questions land in <code>bank/ai/</code>. Check each solution, then verify it into your bank, edit it
        first, or reject it.
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
            <h4>Solution</h4>
            <Solution q={q} />
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
