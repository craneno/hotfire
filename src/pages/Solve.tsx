import { useState } from "react";
import { api } from "../api.ts";
import { navigate, useStore } from "../App.tsx";
import { QuestionCard } from "../components/QuestionCard.tsx";
import { QuestionEditor } from "../components/QuestionEditor.tsx";

export function SolvePage({ id }: { id: string }) {
  const { bank, progress, reloadBank } = useStore();
  const [editing, setEditing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const q = bank.find((x) => x.id === id);

  if (!q)
    return (
      <div className="empty">
        <h2>Question not found</h2>
        <a href="#/problems">Back to problems</a>
      </div>
    );

  // Next unsolved problem in the same area, wrapping around.
  const sameArea = bank.filter((x) => x.area === q.area);
  const idx = sameArea.findIndex((x) => x.id === q.id);
  const next = [...sameArea.slice(idx + 1), ...sameArea.slice(0, idx)].find((x) => !progress.questions[x.id]?.correct);
  const p = progress.questions[q.id];

  return (
    <div className="solve">
      <div className="solve-bar">
        <a href="#/problems">← Problems</a>
        <span className="spacer" />
        {p && (
          <span className="muted small">
            {p.correct}/{p.attempts} correct · next review {new Date(p.dueAt).toLocaleDateString()}
          </span>
        )}
        <button className="btn small ghost" onClick={() => setEditing((e) => !e)}>
          {editing ? "Close editor" : "Edit"}
        </button>
      </div>
      {editing ? (
        <QuestionEditor
          initial={q}
          note={`Editing ${q.verified ? "verified" : "AI"} question ${q.id}. Changes are written to the bank JSON.`}
          onSave={async (edited) => {
            await api.updateQuestion(q.id, edited);
            await reloadBank();
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <QuestionCard
          key={attempt}
          q={q}
          continueLabel={next ? "Next problem →" : "Try again"}
          onContinue={() => (next ? navigate(`/q/${encodeURIComponent(next.id)}`) : setAttempt((a) => a + 1))}
        />
      )}
    </div>
  );
}
