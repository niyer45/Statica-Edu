/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Commit the deployed build came from (set by .github/workflows/pages.yml); absent locally. */
  readonly VITE_BUILD_ID?: string
}
