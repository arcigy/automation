/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_SSGI?: string;
  readonly VITE_ENABLE_PHOTO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

