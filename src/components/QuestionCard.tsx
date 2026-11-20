import { useEffect, useRef, useState } from "react";
import { XP_BY_DIFFICULTY, type Question, type SavedAnswer } from "../../shared/schema.ts";
import { api } from "../api.ts";
import { useStore } from "../App.tsx";
import { AreaBadge, DiffBadge, SourceBadge, TYPE_LABEL } from "./Badges.tsx";
import { Solution } from "./Solution.tsx";

const PLACEHOLDER = {
  calc: "Work it like a whiteboard: knowns, equation, numbers, answer with units.",
  concept: "Your answer and the one-line reason why.",
  interview: "Answer like you would out loud: structure, assumptions, what you'd actually do.",
};

export function QuestionCard({
  q,
  onDone,
  continueLabel = "Continue",
  onContinue,
}: {
  q: Question;
  onDone?: (xp: number) => void;
  continueLabel?: string;
  onContinue?: () => void;
}) {
  const { progress, setProgress, reloadBank } = useStore();
  // Snapshot earlier answers before this attempt adds one.
  const [previous] = useState<SavedAnswer[]>(() => progress.questions[q.id]?.answers ?? []);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [xp, setXp] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  async function finish() {
    if (done) return;
    setDone(true);
    try {
      const r = await api.done(q.id, text);
      setProgress(r.progress);
      setXp(r.xpGained);
      onDone?.(r.xpGained);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function review(action: "approve" | "reject") {
    try {
      if (action === "approve") await api.approve(q.id);
      else await api.remove(q.id);
      setReviewMsg(action === "approve" ? "Moved to your verified bank." : "Deleted from the AI bank.");
      await reloadBank();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (done) continueRef.current?.focus();
  }, [done]);

  // Ctrl/Cmd+Enter finishes from inside the textarea.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      finish();
    }
  }

  return (
    <div className="qcard">
      <div className="qmeta">
        <AreaBadge area={q.area} />
        <DiffBadge d={q.difficulty} />
        <span className="muted">
          {TYPE_LABEL[q.type]} · {q.topic}
        </span>
        <span className="spacer" />
        <SourceBadge q={q} />
      </div>
      <h2 className="qtitle">{q.title}</h2>
      <div className="qprompt">{q.prompt}</div>

      {!done ? (
        <>
          <textarea
            autoFocus
            className="openans"
            placeholder={PLACEHOLDER[q.type]}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={q.type === "concept" ? 4 : 8}
          />
          <div className="actions">
            <button className="btn primary" onClick={finish}>
              Done <span className="xp-hint">+{XP_BY_DIFFICULTY[q.difficulty]} XP</span>
            </button>
            <span className="muted small">Ctrl+Enter · solved on paper? Just hit Done.</span>
          </div>
        </>
      ) : (
        <>
          <div className="compare">
            <section>
              <h4>Your answer</h4>
              {text.trim() ? <p className="pre">{text}</p> : <p className="muted">Nothing written.</p>}
            </section>
            <section className="ref">
              <h4>Solution</h4>
              <Solution q={q} />
            </section>
          </div>

          {previous.length > 0 && (
            <details>
              <summary>Your previous answers ({previous.length})</summary>
              {previous.map((a, i) => (
                <div key={i} className="prev">
                  <span className="muted small">{new Date(a.at).toLocaleString()}</span>
                  <p className="pre">{a.text}</p>
                </div>
              ))}
            </details>
          )}

          {error && <div className="banner err">{error}</div>}
          <div className="actions">
            {xp > 0 && <span className="xp-gain">+{xp} XP</span>}
            {!q.verified && !reviewMsg && (
              <>
                <span className="muted small">AI question. Is the solution right?</span>
                <button className="btn small" onClick={() => review("approve")}>✓ Verify</button>
                <button className="btn small" onClick={() => review("reject")}>✕ Reject</button>
              </>
            )}
            {reviewMsg && <span className="muted small">{reviewMsg}</span>}
            <span className="spacer" />
            {onContinue && (
              <button ref={continueRef} className="btn primary" onClick={onContinue}>
                {continueLabel}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
