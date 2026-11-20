import { useState } from "react";
import { api } from "../api.ts";
import { useStore } from "../App.tsx";
import { QuestionEditor } from "../components/QuestionEditor.tsx";

export function AddPage() {
  const { reloadBank } = useStore();
  const [saved, setSaved] = useState<string | null>(null);
  const [k, setK] = useState(0);
  return (
    <div className="add">
      <h1>Add to your verified bank</h1>
      <p className="muted">
        Saved to <code>bank/verified/&lt;area&gt;.json</code>. No solution yet? Leave it blank and ask Claude to fill in
        missing solutions (see <code>CLAUDE.md</code>). You can also edit the JSON files directly.
      </p>
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
    </div>
  );
}
