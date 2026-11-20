import { AREAS, type AreaId, type Settings } from "../../shared/schema.ts";
import { buildSession, dayKey, isDone, liveStreak } from "../../shared/session.ts";
import { api, readOnly } from "../api.ts";
import { navigate, useStore } from "../App.tsx";

export function HomePage() {
  const { bank, pool, progress, setProgress } = useStore();
  const s = progress.settings;
  const today = progress.daily[dayKey()] ?? 0;
  const goalPct = Math.min(100, Math.round((today / s.dailyGoalXp) * 100));
  const fresh = pool.filter((q) => !isDone(progress, q.id)).length;
  const next = buildSession(pool, progress, s.sessionLength).length;
  const streak = liveStreak(progress);

  async function update(patch: Partial<Settings>) {
    setProgress(await api.settings(patch));
  }

  function toggleArea(a: AreaId) {
    const on = s.focusAreas.includes(a);
    if (on && s.focusAreas.length === 1) return;
    update({ focusAreas: on ? s.focusAreas.filter((x) => x !== a) : [...s.focusAreas, a] });
  }

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const k = dayKey(d);
    return { k, xp: progress.daily[k] ?? 0, label: d.toLocaleDateString(undefined, { weekday: "narrow" }) };
  });
  const maxDay = Math.max(s.dailyGoalXp, ...last14.map((d) => d.xp));

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-left">
          <h1>{greeting(today, s.dailyGoalXp)}</h1>
          <p className="muted">
            {fresh} new in your focus areas · {pool.length - fresh} done
          </p>
          <button className="btn primary big" disabled={next === 0} onClick={() => navigate("/practice")}>
            {next === 0 ? "Nothing to practice — add or generate questions" : `Start session · ${next} questions`}
          </button>
        </div>
        <div className="hero-right">
          <div className="goal">
            <div className="ring" style={{ ["--pct" as string]: `${goalPct}` }}>
              <span>{today}</span>
              <small>/ {s.dailyGoalXp} XP</small>
            </div>
            <div className="goal-meta">
              <div className={streak ? "streak big on" : "streak big"}>🔥 {streak} day streak</div>
              <div className="muted">Best: {progress.bestStreak}</div>
            </div>
          </div>
          <div className="spark">
            {last14.map((d) => (
              <div key={d.k} className="bar-wrap" title={`${d.k}: ${d.xp} XP`}>
                <div
                  className={d.xp >= s.dailyGoalXp ? "bar hit" : "bar"}
                  style={{ height: `${Math.max(3, (d.xp / maxDay) * 100)}%` }}
                />
                <small>{d.label}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <h3>Focus areas</h3>
      <p className="muted small">Pick what you're interviewing for. Sessions only draw from selected areas.</p>
      <div className="areas">
        {AREAS.map((a) => {
          const qs = bank.filter((q) => q.area === a.id && (!s.verifiedOnly || q.verified));
          const done = qs.filter((q) => isDone(progress, q.id)).length;
          const on = s.focusAreas.includes(a.id);
          return (
            <button key={a.id} className={`area-card area-${a.id} ${on ? "on" : ""}`} onClick={() => toggleArea(a.id)}>
              <div className="area-head">
                <span className="emoji">{a.emoji}</span>
                <span className="check">{on ? "✓" : ""}</span>
              </div>
              <div className="area-name">{a.label}</div>
              <div className="meter">
                <div style={{ width: `${qs.length ? (done / qs.length) * 100 : 0}%` }} />
              </div>
              <div className="muted small">
                {done}/{qs.length} done
              </div>
            </button>
          );
        })}
      </div>

      <h3>Settings</h3>
      <div className="settings">
        <label>
          Session length
          <select value={s.sessionLength} onChange={(e) => update({ sessionLength: Number(e.target.value) })}>
            {[5, 10, 15, 20, 30].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Daily goal
          <select value={s.dailyGoalXp} onChange={(e) => update({ dailyGoalXp: Number(e.target.value) })}>
            {[30, 60, 100, 150, 250].map((n) => (
              <option key={n} value={n}>
                {n} XP
              </option>
            ))}
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={s.verifiedOnly} onChange={(e) => update({ verifiedOnly: e.target.checked })} />
          Verified questions only
        </label>
        <span className="spacer" />
        {readOnly && <span className="muted small">Progress is saved in this browser.</span>}
        <button
          className="btn small ghost"
          onClick={async () => {
            if (confirm("Reset XP, streak and all question history? Your question bank is not touched."))
              setProgress(await api.resetProgress());
          }}
        >
          Reset progress
        </button>
      </div>
    </div>
  );
}

function greeting(today: number, goal: number) {
  if (today >= goal) return "Daily goal hit. Keep the engine lit.";
  if (today > 0) return `${goal - today} XP to today's goal.`;
  const h = new Date().getHours();
  return h < 12 ? "Morning. T-minus one session." : h < 18 ? "Afternoon hot fire?" : "Evening reps.";
}
