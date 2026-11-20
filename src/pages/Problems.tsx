import { useMemo, useState } from "react";
import { AREAS, type AreaId, type Difficulty, type QuestionType } from "../../shared/schema.ts";
import { navigate, useStore } from "../App.tsx";
import { AreaBadge, DiffBadge, TYPE_LABEL } from "../components/Badges.tsx";

type Status = "all" | "done" | "todo";

export function ProblemsPage() {
  const { bank, progress } = useStore();
  const [area, setArea] = useState<AreaId | "all">("all");
  const [diff, setDiff] = useState<Difficulty | "all">("all");
  const [type, setType] = useState<QuestionType | "all">("all");
  const [status, setStatus] = useState<Status>("all");
  const [source, setSource] = useState<"all" | "verified" | "ai">("all");
  const [search, setSearch] = useState("");

  const statusOf = (id: string) => (progress.questions[id]?.attempts ? "done" : "todo");

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return bank
      .filter(
        (q) =>
          (area === "all" || q.area === area) &&
          (diff === "all" || q.difficulty === diff) &&
          (type === "all" || q.type === type) &&
          (source === "all" || (source === "verified") === q.verified) &&
          (status === "all" || statusOf(q.id) === status) &&
          (!s || `${q.title} ${q.topic} ${q.prompt} ${q.tags.join(" ")}`.toLowerCase().includes(s)),
      )
      .sort(
        (a, b) =>
          AREAS.findIndex((x) => x.id === a.area) - AREAS.findIndex((x) => x.id === b.area) ||
          ["easy", "medium", "hard"].indexOf(a.difficulty) - ["easy", "medium", "hard"].indexOf(b.difficulty) ||
          a.title.localeCompare(b.title),
      );
  }, [bank, progress, area, diff, type, status, source, search]);

  const counts = (["easy", "medium", "hard"] as const).map((d) => {
    const all = bank.filter((q) => q.difficulty === d && (area === "all" || q.area === area));
    return { d, total: all.length, solved: all.filter((q) => statusOf(q.id) === "done").length };
  });

  return (
    <div className="problems">
      <div className="problems-head">
        <h1>Problems</h1>
        <div className="solved-counts">
          {counts.map((c) => (
            <span key={c.d} className={`diff diff-${c.d}`}>
              {c.d[0].toUpperCase() + c.d.slice(1)} {c.solved}/{c.total}
            </span>
          ))}
        </div>
      </div>
      <div className="filters">
        <input placeholder="Search title, topic, tags…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={area} onChange={(e) => setArea(e.target.value as AreaId | "all")}>
          <option value="all">All areas</option>
          {AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <select value={diff} onChange={(e) => setDiff(e.target.value as Difficulty | "all")}>
          <option value="all">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value as QuestionType | "all")}>
          <option value="all">Any type</option>
          {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          <option value="all">Any status</option>
          <option value="todo">To do</option>
          <option value="done">Done</option>
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value as "all" | "verified" | "ai")}>
          <option value="all">Verified + AI</option>
          <option value="verified">Verified only</option>
          <option value="ai">AI unreviewed</option>
        </select>
      </div>

      <table className="ptable">
        <thead>
          <tr>
            <th style={{ width: 36 }}></th>
            <th>Title</th>
            <th>Area</th>
            <th>Type</th>
            <th>Difficulty</th>
            <th>Last done</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((q) => {
            const p = progress.questions[q.id];
            const st = statusOf(q.id);
            return (
              <tr key={q.id} onClick={() => navigate(`/q/${encodeURIComponent(q.id)}`)}>
                <td className={`st st-${st}`}>{st === "done" ? "✓" : ""}</td>
                <td>
                  <div className="ptitle">
                    {q.title}
                    {!q.verified && <span className="badge unverified tiny">AI</span>}
                  </div>
                  <div className="muted small">{q.topic}</div>
                </td>
                <td>
                  <AreaBadge area={q.area} />
                </td>
                <td className="muted small">{TYPE_LABEL[q.type]}</td>
                <td>
                  <DiffBadge d={q.difficulty} />
                </td>
                <td className="muted small">{p ? new Date(p.lastSeen).toLocaleDateString() : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className="muted center">No problems match these filters.</p>}
    </div>
  );
}
