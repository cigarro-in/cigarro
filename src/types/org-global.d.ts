// Store identity injected by the edge (functions/_middleware.js) into <head>.
export {};

declare global {
  interface Window {
    __ORG__?: {
      slug: string;
      id: string | null;
      name: string;
      primaryHost: string;
      themeId?: string | null;
    };
    /** Set by the SSR entry when it ships server-rendered markup; enables hydrateRoot in main.tsx. */
    __SSR__?: boolean;
  }
}
