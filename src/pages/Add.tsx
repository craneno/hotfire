import { useState } from "react";
import { AREAS, type AreaId, type QuestionInput } from "../../shared/schema.ts";
import { api } from "../api.ts";
import { useStore } from "../App.tsx";
import { QuestionEditor } from "../components/QuestionEditor.tsx";

type Draft = { key: number; question: QuestionInput; inferred: string };

export function AddPage() {
  const [tab, setTab] = useState<"write" | "import">("write");
  return (
    <div className="add">
      <h1>Add to your verified bank</h1>
      <p className="muted">
        Questions you add here go straight into <code>bank/verified/&lt;area&gt;.json</code>. You can also edit those files
        by hand; see the README for the format.
      </p>
      <div className="tabs">
        <button className={tab === "write" ? "on" : ""} onClick={() => setTab("write")}>
          Write one
        </button>
        <button className={tab === "import" ? "on" : ""} onClick={() => setTab("import")}>
          Import from notes
        </button>
      </div>
      {tab === "write" ? <WriteOne /> : <ImportNotes />}
    </div>
  );
}

function WriteOne() {
  const { reloadBank } = useStore();
  const [saved, setSaved] = useState<string | null>(null);
  const [k, setK] = useState(0);
  return (
    <>
      {saved && <div className="banner ok">Saved “{saved}”.</div>}
      <QuestionEditor
        key={k}
        saveLabel="Save to verified bank"
        onSave={async (q) => {
          const { added } = await api.addQuestions([{ ...q, origin: "human" }]);
          if (!added.length) throw new Error("A question with the same area and prompt already exists.");
          await reloadBank();
          setSaved(q.title);
          setK((x) => x + 1);
        }}
      />
    </>
  );
}

function ImportNotes() {
  const { ai, reloadBank } = useStore();
  const [text, setText] = useState("");
  const [area, setArea] = useState<AreaId | "auto">("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [savedCount, setSavedCount] = useState(0);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.importText(text, area === "auto" ? null : area);
      setDrafts(r.drafts.map((d, i) => ({ ...d, key: Date.now() + i })));
      setRejected(r.rejected);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    const { added } = await api.addQuestions(drafts.map((d) => d.question));
    setSavedCount((n) => n + added.length);
    setDrafts([]);
    await reloadBank();
  }

  if (!ai.configured)
    return (
      <div className="banner warn">
        Importing from free-form notes uses Claude to structure them. Add <code>ANTHROPIC_API_KEY</code> to <code>.env</code>{" "}
        and restart <code>npm run dev</code>. Or write questions one at a time, or edit the JSON files directly.
      </div>
    );

  return (
    <div className="import">
      <p className="muted small">
        Paste questions in any format: a doc, a list, interview notes. Your wording is kept; missing answers, rubrics and
        explanations are filled in and flagged so you can check them before saving.
      </p>
      <textarea
        rows={12}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          "1. A 3 m diameter tank at 4 bar, Al 2219 yield 300 MPa, FS 1.4. Min wall thickness? (ans ~2.8 mm)\n2. Walk me through how you'd find a leak in a LOX feedline after a failed decay check.\n…"
        }
      />
      <div className="row">
        <label>
          Default area
          <select value={area} onChange={(e) => setArea(e.target.value as AreaId | "auto")}>
            <option value="auto">Detect per question</option>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <span className="spacer" />
        <button className="btn primary" disabled={busy || !text.trim()} onClick={run}>
          {busy ? "Structuring…" : "Structure questions"}
        </button>
      </div>
      {error && <div className="banner err">{error}</div>}
      {savedCount > 0 && <div className="banner ok">{savedCount} question(s) saved to your verified bank.</div>}
      {rejected.length > 0 && (
        <div className="banner warn">
          Couldn't structure: {rejected.map((r, i) => <div key={i}>{r}</div>)}
        </div>
      )}
      {drafts.length > 0 && (
        <>
          <div className="row">
            <h3>{drafts.length} draft(s) — review, then save</h3>
            <span className="spacer" />
            <button className="btn primary" onClick={saveAll}>
              Save all to verified
            </button>
          </div>
          {drafts.map((d) => (
            <div className="draft" key={d.key}>
              <QuestionEditor
                initial={d.question}
                note={d.inferred ? `Filled in by AI: ${d.inferred}` : undefined}
                saveLabel="Save this one"
                onSave={async (q) => {
                  await api.addQuestions([q]);
                  setSavedCount((n) => n + 1);
                  setDrafts((ds) => ds.filter((x) => x.key !== d.key));
                  await reloadBank();
                }}
                onCancel={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
