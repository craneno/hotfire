import { useState } from "react";
import { AREAS, type AreaId, type Difficulty, type Question, type QuestionType } from "../../shared/schema.ts";
import { api } from "../api.ts";
import { useStore } from "../App.tsx";
import { DiffBadge, TYPE_LABEL } from "../components/Badges.tsx";
import { KeyHint } from "../components/KeyHint.tsx";

export function GeneratePage() {
  const { ai, bank, reloadBank, progress } = useStore();
  const [area, setArea] = useState<AreaId>(progress.settings.focusAreas[0] ?? "manufacturing");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "mixed">("mixed");
  const [types, setTypes] = useState<QuestionType[]>(["mcq", "numeric", "open"]);
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: Question[]; rejected: string[] } | null>(null);

  const verifiedInArea = bank.filter((q) => q.area === area && q.verified).length;

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.generate({ area, count, difficulty, types, topic: topic.trim() || undefined });
      setResult(r);
      await reloadBank();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="generate">
      <h1>Generate questions</h1>
      <p className="muted">
        {ai.model || "The AI model"} writes new questions into <code>bank/ai/</code>, using your verified questions in that area as the style and
        difficulty reference. They're playable right away, tagged “AI · unreviewed”, until you verify them in Review.
      </p>
      {!ai.configured && (
        <div className="banner warn">
          No API key found for {ai.provider}. Add <KeyHint /> to <code>.env</code> and restart{" "}
          <code>npm run dev</code>.
        </div>
      )}
      <div className="panel">
        <div className="row">
          <label>
            Focus area
            <select value={area} onChange={(e) => setArea(e.target.value as AreaId)}>
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | "mixed")}>
              <option value="mixed">Mixed</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label>
            How many
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[1, 3, 5, 8, 10].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Topic (optional)
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. friction stir welding defects, COPV failure modes, regen cooling ΔP, cell-to-pack thermal runaway"
          />
        </label>
        <div className="row">
          {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
            <label key={t} className="toggle">
              <input
                type="checkbox"
                checked={types.includes(t)}
                onChange={(e) => setTypes((ts) => (e.target.checked ? [...ts, t] : ts.filter((x) => x !== t)))}
              />
              {TYPE_LABEL[t]}
            </label>
          ))}
        </div>
        <div className="row">
          <span className="muted small">
            {verifiedInArea
              ? `${verifiedInArea} verified question(s) in this area will steer style.`
              : "No verified questions in this area yet. Add a few of yours first for better calibration."}
          </span>
          <span className="spacer" />
          <button className="btn primary" disabled={busy || !types.length || !ai.configured} onClick={run}>
            {busy ? "Writing questions… (can take a minute)" : `Generate ${count}`}
          </button>
        </div>
      </div>
      {error && <div className="banner err">{error}</div>}
      {result && (
        <div className="panel">
          <h3>
            Added {result.added.length} question{result.added.length === 1 ? "" : "s"}
          </h3>
          <ul className="gen-list">
            {result.added.map((q) => (
              <li key={q.id}>
                <a href={`#/q/${encodeURIComponent(q.id)}`}>{q.title}</a> <DiffBadge d={q.difficulty} />{" "}
                <span className="muted small">{TYPE_LABEL[q.type]}</span>
              </li>
            ))}
          </ul>
          {result.rejected.length > 0 && (
            <div className="banner warn">
              Dropped {result.rejected.length} malformed:
              {result.rejected.map((r, i) => (
                <div key={i} className="small">
                  {r}
                </div>
              ))}
            </div>
          )}
          <a className="btn" href="#/review">
            Review them →
          </a>
        </div>
      )}
    </div>
  );
}
