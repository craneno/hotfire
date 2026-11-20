/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" for the GitHub Pages build: bank from bank.json, progress in localStorage, no editing. */
  readonly VITE_STATIC?: string;
}
