import { useState } from "react";
import type { Question, QuestionProgress } from "../../shared/schema.ts";
import { buildSession } from "../../shared/srs.ts";
import { navigate, useStore } from "../App.tsx";
import { QuestionCard } from "../components/QuestionCard.tsx";

type Done = { q: Question; result: QuestionProgress["lastResult"]; xp: number };

export function PracticePage() {
  const { pool, progress } = useStore();
  const [queue, setQueue] = useState<Question[]>(() => buildSession(pool, progress, progress.settings.sessionLength));
  const [i, setI] = useState(0);
  const [done, setDone] = useState<Done[]>([]);
  const [requeued, setRequeued] = useState<Set<string>>(new Set());
  const [round, setRound] = useState(0);
  const [baseLen, setBaseLen] = useState(queue.length);

  if (queue.length === 0)
    return (
      <div className="empty">
        <h2>Nothing to practice</h2>
        <p className="muted">Your focus areas have no questions yet. Add your own or generate some.</p>
        <div className="actions center">
          <a className="btn primary" href="#/add">Add questions</a>
          <a className="btn" href="#/generate">Generate with AI</a>
        </div>
      </div>
    );

  if (i >= queue.length) {
    // Summary counts first attempts only, so a requeued miss doesn't count twice.
    const first = new Map<string, Done>();
    for (const d of done) if (!first.has(d.q.id)) first.set(d.q.id, d);
    const firsts = [...first.values()];
    const xp = done.reduce((n, d) => n + d.xp, 0);
    const correct = firsts.filter((d) => d.result === "correct").length;
    return (
      <div className="summary">
        <div className="trophy">{correct === firsts.length ? "🏆" : correct / firsts.length >= 0.6 ? "🚀" : "🔧"}</div>
        <h1>Session complete</h1>
        <div className="summary-stats">
          <div>
            <strong>+{xp}</strong>
            <span>XP</span>
          </div>
          <div>
            <strong>
              {correct}/{firsts.length}
            </strong>
            <span>first-try correct</span>
          </div>
          <div>
            <strong>{Math.round((correct / firsts.length) * 100)}%</strong>
            <span>accuracy</span>
          </div>
        </div>
        <ul className="recap">
          {firsts.map((d) => (
            <li key={d.q.id}>
              <span className={`dot ${d.result}`} />
              <a href={`#/q/${encodeURIComponent(d.q.id)}`}>{d.q.title}</a>
            </li>
          ))}
        </ul>
        <div className="actions center">
          <button
            className="btn primary"
            onClick={() => {
              const next = buildSession(pool, progress, progress.settings.sessionLength);
              setQueue(next);
              setBaseLen(next.length);
              setI(0);
              setDone([]);
              setRequeued(new Set());
              setRound((r) => r + 1);
            }}
          >
            Another session
          </button>
          <button className="btn" onClick={() => navigate("/")}>
            Home
          </button>
        </div>
      </div>
    );
  }

  const q = queue[i];
  const pct = (i / queue.length) * 100;

  return (
    <div className="practice">
      <div className="session-bar">
        <button className="btn ghost small" onClick={() => navigate("/")} title="Quit session">
          ✕
        </button>
        <div className="track">
          <div style={{ width: `${pct}%` }} />
        </div>
        <span className="muted small">
          {i + 1}/{queue.length}
        </span>
      </div>
      {i >= baseLen && (
        <div className="banner info">Second look at one you missed.</div>
      )}
      <QuestionCard
        key={`${round}-${i}-${q.id}`}
        q={q}
        onDone={(result, xp) => {
          setDone((d) => [...d, { q, result, xp }]);
          // Duolingo-style: a miss comes back once at the end of the session.
          if (result === "wrong" && !requeued.has(q.id)) {
            setRequeued((s) => new Set(s).add(q.id));
            setQueue((qs) => [...qs, q]);
          }
        }}
        continueLabel={i + 1 >= queue.length ? "Finish" : "Continue"}
        onContinue={() => setI((n) => n + 1)}
      />
    </div>
  );
}
