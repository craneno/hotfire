import { useStore } from "../App.tsx";

/** Names the env var the current provider needs. */
export function KeyHint() {
  const { ai } = useStore();
  return <code>{ai.provider === "google" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY"}</code>;
}
