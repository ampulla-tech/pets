/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Navigator {
  /** iOS Safari: true when the page runs from the Home Screen. */
  readonly standalone?: boolean;
}
