import { AREAS, type AreaId, type Difficulty, type Question } from "../../shared/schema.ts";

export function AreaBadge({ area }: { area: AreaId }) {
  const a = AREAS.find((x) => x.id === area)!;
  return (
    <span className={`badge area-${area}`} title={a.label}>
      {a.emoji} {a.short}
    </span>
  );
}

export function DiffBadge({ d }: { d: Difficulty }) {
  return <span className={`diff diff-${d}`}>{d[0].toUpperCase() + d.slice(1)}</span>;
}

export function SourceBadge({ q }: { q: Pick<Question, "verified" | "origin"> }) {
  if (q.verified) return <span className="badge verified" title="In your verified bank">✓ verified</span>;
  return <span className="badge unverified" title="AI-written, not yet reviewed">AI · unreviewed</span>;
}

export const TYPE_LABEL = { mcq: "Multiple choice", numeric: "Hand calc", open: "Interview answer" } as const;
