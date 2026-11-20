import type { Question } from "../../shared/schema.ts";

/** The reference solution: short answer, worked solution, key points. */
export function Solution({ q }: { q: Question }) {
  if (!q.answer && !q.solution && !q.keyPoints.length)
    return <p className="muted">No solution written yet. Ask Claude to fill it in (see CLAUDE.md).</p>;
  return (
    <div className="solution">
      {q.answer && (
        <div className="final">
          <span className="muted small">Answer</span>
          <strong className="pre">{q.answer}</strong>
        </div>
      )}
      {q.solution && <p className="pre">{q.solution}</p>}
      {q.keyPoints.length > 0 && (
        <>
          <h4>Key points</h4>
          <ul className="rubric">
            {q.keyPoints.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
