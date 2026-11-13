# Cigarro

Multi-store platform for regulated (tobacco) retail in India, paid via UPI. One codebase serves many stores; the store is picked from the request hostname. React + Vite frontend on Cloudflare Pages, Convex for data, payments and orders, own ES256 JWT auth.

## Running the code

```bash
npm i            # install dependencies
npm run dev      # Vite dev server
npm run build    # client + SSR bundle
npm run verify   # type-check (app + convex), guards, lint, build
npx convex dev   # Convex dev deployment (local .env.local points at DEV)
```

## Docs

- `CLAUDE.md` (also `AGENTS.md`): architecture, rules and conventions for AI sessions. Read it first.
- `PLATFORM_PLAN.md`: multi-store platform status and what remains.
- `DESIGN.md`: admin UI design rules.
- `convex/README.md`: backend layout and payments/wallet model.
- `imports/the2935/README.md`: Dukaan store import runbook.
