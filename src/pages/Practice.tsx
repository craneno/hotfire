import { useState } from "react";
import type { Question } from "../../shared/schema.ts";
import { buildSession } from "../../shared/session.ts";
import { navigate, useStore } from "../App.tsx";
import { QuestionCard } from "../components/QuestionCard.tsx";

export function PracticePage() {
  const { pool, progress } = useStore();
  const newSession = () => buildSession(pool, progress, progress.settings.sessionLength);
  const [queue, setQueue] = useState<Question[]>(newSession);
  const [i, setI] = useState(0);
  const [xp, setXp] = useState(0);
  const [round, setRound] = useState(0);

  if (queue.length === 0)
    return (
      <div className="empty">
        <h2>Nothing to practice</h2>
        <p className="muted">Your focus areas have no questions yet.</p>
        <div className="actions center">
          <a className="btn primary" href="#/add">Add questions</a>
        </div>
      </div>
    );

  if (i >= queue.length)
    return (
      <div className="summary">
        <div className="trophy">🚀</div>
        <h1>Session complete</h1>
        <div className="summary-stats">
          <div>
            <strong>+{xp}</strong>
            <span>XP</span>
          </div>
          <div>
            <strong>{queue.length}</strong>
            <span>questions</span>
          </div>
        </div>
        <ul className="recap">
          {queue.map((q) => (
            <li key={q.id}>
              <span className="dot correct" />
              <a href={`#/q/${encodeURIComponent(q.id)}`}>{q.title}</a>
            </li>
          ))}
        </ul>
        <div className="actions center">
          <button
            className="btn primary"
            onClick={() => {
              setQueue(newSession());
              setI(0);
              setXp(0);
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

  const q = queue[i];
  return (
    <div className="practice">
      <div className="session-bar">
        <button className="btn ghost small" onClick={() => navigate("/")} title="Quit session">
          ✕
        </button>
        <div className="track">
          <div style={{ width: `${(i / queue.length) * 100}%` }} />
        </div>
        <span className="muted small">
          {i + 1}/{queue.length}
        </span>
      </div>
      <QuestionCard
        key={`${round}-${i}-${q.id}`}
        q={q}
        onDone={(gained) => setXp((x) => x + gained)}
        continueLabel={i + 1 >= queue.length ? "Finish" : "Continue"}
        onContinue={() => setI((n) => n + 1)}
      />
    </div>
  );
}
