import { useEffect, useRef, useState } from "react";
import type { GradeResult, Question, QuestionProgress } from "../../shared/schema.ts";
import { checkNumeric, xpFor } from "../../shared/srs.ts";
import { api } from "../api.ts";
import { useStore } from "../App.tsx";
import { AreaBadge, DiffBadge, SourceBadge, TYPE_LABEL } from "./Badges.tsx";

type Result = QuestionProgress["lastResult"];
type Phase = "answering" | "grading" | "done";

export function QuestionCard({
  q,
  onDone,
  continueLabel = "Continue",
  onContinue,
}: {
  q: Question;
  /** Called once the attempt is recorded. */
  onDone?: (result: Result, xp: number) => void;
  continueLabel?: string;
  onContinue?: () => void;
}) {
  const { ai, setProgress, reloadBank } = useStore();
  const [phase, setPhase] = useState<Phase>("answering");
  const [result, setResult] = useState<Result | null>(null);
  const [xp, setXp] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // per-type input state
  const [choice, setChoice] = useState<number | null>(null);
  const [num, setNum] = useState("");
  const [text, setText] = useState("");
  const [grade, setGrade] = useState<(GradeResult & { followUp: string }) | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  async function record(r: Result) {
    setResult(r);
    setPhase("done");
    try {
      const { progress, xpGained } = await api.attempt(q.id, r);
      setProgress(progress);
      setXp(xpGained);
      onDone?.(r, xpGained);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function check() {
    if (phase !== "answering") return;
    if (q.type === "mcq" && choice !== null) record(choice === q.answerIndex ? "correct" : "wrong");
    if (q.type === "numeric" && num.trim()) {
      const given = Number(num.replace(/,/g, ""));
      record(checkNumeric(given, q.answer, q.tolerancePct) ? "correct" : "wrong");
    }
  }

  async function aiGrade() {
    if (!text.trim()) return;
    setPhase("grading");
    setError(null);
    try {
      const g = await api.grade(q.id, text);
      setGrade(g);
      await record(g.verdict);
    } catch (e) {
      setError((e as Error).message);
      setPhase("answering");
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
    if (phase === "done") continueRef.current?.focus();
  }, [phase]);

  // Keyboard: 1-4 picks a choice, Enter checks / continues.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || (tag === "INPUT" && e.key !== "Enter")) return;
      if (q.type === "mcq" && phase === "answering" && /^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < q.choices.length) setChoice(i);
      }
      if (e.key === "Enter" && phase === "answering" && q.type !== "open") {
        e.preventDefault();
        check();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const potential = xpFor(q, "correct");

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

      {q.type === "mcq" && (
        <div className="choices">
          {q.choices.map((c, i) => {
            let cls = "choice";
            if (phase === "done") {
              if (i === q.answerIndex) cls += " right";
              else if (i === choice) cls += " wrong";
            } else if (i === choice) cls += " picked";
            return (
              <button key={i} className={cls} disabled={phase !== "answering"} onClick={() => setChoice(i)}>
                <span className="key">{i + 1}</span>
                {c}
              </button>
            );
          })}
        </div>
      )}

      {q.type === "numeric" && (
        <div className="numeric">
          <input
            autoFocus
            inputMode="decimal"
            placeholder="Your answer"
            value={num}
            disabled={phase !== "answering"}
            onChange={(e) => setNum(e.target.value)}
          />
          <span className="unit">{q.unit}</span>
        </div>
      )}

      {q.type === "open" && (
        <textarea
          className="openans"
          placeholder="Answer like you would out loud in the interview. Structure, assumptions, numbers."
          value={text}
          disabled={phase !== "answering"}
          onChange={(e) => setText(e.target.value)}
          rows={8}
        />
      )}

      {error && <div className="banner err">{error}</div>}

      {phase !== "done" && (
        <div className="actions">
          {q.type !== "open" && (
            <button
              className="btn primary"
              disabled={(q.type === "mcq" && choice === null) || (q.type === "numeric" && !num.trim())}
              onClick={check}
            >
              Check <span className="xp-hint">+{potential} XP</span>
            </button>
          )}
          {q.type === "open" && (
            <>
              {ai.configured && (
                <button className="btn primary" disabled={!text.trim() || phase === "grading"} onClick={aiGrade}>
                  {phase === "grading" ? "Grading…" : "Grade with AI"}
                </button>
              )}
              <button className="btn" disabled={phase === "grading"} onClick={() => setRevealed(true)}>
                {ai.configured ? "Self-grade instead" : "Reveal & self-grade"}
              </button>
            </>
          )}
        </div>
      )}

      {q.type === "open" && revealed && phase === "answering" && (
        <div className="feedback neutral">
          <h4>What a strong answer covers</h4>
          <ul className="rubric">
            {q.rubric.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <h4>Model answer</h4>
          <p className="pre">{q.modelAnswer}</p>
          <div className="actions">
            <span className="muted">How did you do?</span>
            <button className="btn good" onClick={() => record("correct")}>Nailed it</button>
            <button className="btn meh" onClick={() => record("partial")}>Partial</button>
            <button className="btn bad" onClick={() => record("wrong")}>Missed it</button>
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div className={`feedback ${result}`}>
          <div className="verdict">
            <strong>{result === "correct" ? "Correct!" : result === "partial" ? "Partially there" : "Not quite"}</strong>
            {xp > 0 && <span className="xp-gain">+{xp} XP</span>}
          </div>

          {q.type === "numeric" && (
            <p>
              Answer: <strong>{fmt(q.answer)} {q.unit}</strong>
              {q.tolerancePct > 0 && <span className="muted"> (±{q.tolerancePct}%)</span>}
              {num && <span className="muted"> · you said {num}</span>}
            </p>
          )}

          {grade && (
            <>
              <p>
                Score <strong>{grade.score}/100</strong> — {grade.feedback}
              </p>
              {grade.hits.length > 0 && (
                <ul className="hits">
                  {grade.hits.map((h, i) => (
                    <li key={i}>✓ {h}</li>
                  ))}
                </ul>
              )}
              {grade.misses.length > 0 && (
                <ul className="misses">
                  {grade.misses.map((h, i) => (
                    <li key={i}>✗ {h}</li>
                  ))}
                </ul>
              )}
              {grade.followUp && (
                <p className="followup">
                  <span className="muted">Interviewer follow-up:</span> {grade.followUp}
                </p>
              )}
            </>
          )}

          {q.type === "open" && (grade || !revealed) && (
            <details>
              <summary>Model answer & rubric</summary>
              <ul className="rubric">
                {q.rubric.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <p className="pre">{q.modelAnswer}</p>
            </details>
          )}

          {q.explanation && (
            <>
              <h4>Why</h4>
              <p className="pre">{q.explanation}</p>
            </>
          )}

          <div className="actions">
            {!q.verified && !reviewMsg && (
              <>
                <span className="muted">AI question. Is it right?</span>
                <button className="btn small" onClick={() => review("approve")}>✓ Verify</button>
                <button className="btn small" onClick={() => review("reject")}>✕ Reject</button>
              </>
            )}
            {reviewMsg && <span className="muted">{reviewMsg}</span>}
            <span className="spacer" />
            {onContinue && (
              <button ref={continueRef} className="btn primary" onClick={onContinue}>
                {continueLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(n: number) {
  return Math.abs(n) >= 1e5 || (Math.abs(n) < 1e-3 && n !== 0) ? n.toExponential(3) : String(+n.toPrecision(6));
}
