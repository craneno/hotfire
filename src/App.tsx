import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Progress, Question } from "../shared/schema.ts";
import { liveStreak } from "../shared/srs.ts";
import { api, type BankError } from "./api.ts";
import { AddPage } from "./pages/Add.tsx";
import { GeneratePage } from "./pages/Generate.tsx";
import { HomePage } from "./pages/Home.tsx";
import { PracticePage } from "./pages/Practice.tsx";
import { ProblemsPage } from "./pages/Problems.tsx";
import { ReviewPage } from "./pages/Review.tsx";
import { SolvePage } from "./pages/Solve.tsx";

type Store = {
  bank: Question[];
  bankErrors: BankError[];
  progress: Progress;
  ai: { configured: boolean; model: string };
  setProgress: (p: Progress) => void;
  reloadBank: () => Promise<void>;
  /** Questions eligible for practice under current settings. */
  pool: Question[];
};

const StoreCtx = createContext<Store | null>(null);
export const useStore = () => useContext(StoreCtx)!;

export function navigate(to: string) {
  window.location.hash = to;
}

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

const NAV = [
  { to: "/", label: "Home" },
  { to: "/practice", label: "Practice" },
  { to: "/problems", label: "Problems" },
  { to: "/add", label: "Add" },
  { to: "/generate", label: "Generate" },
  { to: "/review", label: "Review" },
];

export function App() {
  const route = useHashRoute();
  const [bank, setBank] = useState<Question[] | null>(null);
  const [bankErrors, setBankErrors] = useState<BankError[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [ai, setAi] = useState({ configured: false, model: "" });
  const [fatal, setFatal] = useState<string | null>(null);

  const reloadBank = useCallback(async () => {
    const b = await api.bank();
    setBank(b.questions);
    setBankErrors(b.errors);
  }, []);

  useEffect(() => {
    Promise.all([reloadBank(), api.progress().then(setProgress), api.aiStatus().then(setAi)]).catch((e) =>
      setFatal(`Can't reach the API server (${e.message}). Is \`npm run dev\` running?`),
    );
  }, [reloadBank]);

  const pool = useMemo(() => {
    if (!bank || !progress) return [];
    const s = progress.settings;
    return bank.filter((q) => s.focusAreas.includes(q.area) && (!s.verifiedOnly || q.verified));
  }, [bank, progress]);

  if (fatal) return <div className="fatal">{fatal}</div>;
  if (!bank || !progress) return <div className="loading">Loading…</div>;

  const pending = bank.filter((q) => !q.verified).length;
  const streak = liveStreak(progress);
  const base = "/" + (route.split("/")[1] ?? "");

  let page: React.ReactNode;
  if (route.startsWith("/q/")) page = <SolvePage key={route} id={decodeURIComponent(route.slice(3))} />;
  else if (base === "/practice") page = <PracticePage />;
  else if (base === "/problems") page = <ProblemsPage />;
  else if (base === "/add") page = <AddPage />;
  else if (base === "/generate") page = <GeneratePage />;
  else if (base === "/review") page = <ReviewPage />;
  else page = <HomePage />;

  return (
    <StoreCtx.Provider value={{ bank, bankErrors, progress, ai, setProgress, reloadBank, pool }}>
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="logo">🔥</span> hotfire
        </a>
        <nav>
          {NAV.map((n) => (
            <a key={n.to} href={`#${n.to}`} className={base === n.to || (n.to === "/problems" && base === "/q") ? "active" : ""}>
              {n.label}
              {n.to === "/review" && pending > 0 && <span className="pill">{pending}</span>}
            </a>
          ))}
        </nav>
        <div className="stats">
          <span title="Day streak" className={streak ? "streak on" : "streak"}>
            🔥 {streak}
          </span>
          <span title="Total XP" className="xp">
            ⚡ {progress.xp}
          </span>
        </div>
      </header>
      {bankErrors.length > 0 && (
        <div className="banner warn">
          {bankErrors.length} bank entr{bankErrors.length === 1 ? "y" : "ies"} failed validation and {bankErrors.length === 1 ? "is" : "are"} skipped:
          <ul>
            {bankErrors.slice(0, 5).map((e, i) => (
              <li key={i}>
                <code>
                  {e.file}
                  {e.index >= 0 ? `[${e.index}]` : ""}
                </code>{" "}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <main>{page}</main>
    </StoreCtx.Provider>
  );
}
