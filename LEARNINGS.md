# LEARNINGS — Cigarro project (durable, cross-session)

Purpose: distilled system-level memory so any agent (or future-me) starts
effective. Facts first, then standing rules. Updated as lessons are earned.
Last updated: 2026-09-11.

## 1. Project facts (verified, not assumed)

- React + Vite SPA on Cloudflare Pages; catalog/content on Supabase;
  payments/orders/wallet on Convex (`proper-coyote-383.convex.cloud`).
- Auth: phone OTP via MSG91 widget → Pages Function `phone-verify`
  (synthetic `<phone>@phone.cigarro.in` email exists ONLY because Supabase
  `generateLink(magiclink)` requires an email) → Supabase session → Convex
  customJwt bridge. No passwords anywhere.
- Money: Supabase catalog in RUPEES; Convex boundary in integer PAISE
  (`rupeesToPaise`). Checkout does NOT re-price (cart snapshots → order).
- Images: live on R2/CDN (`cdn.cigarro.in`); Supabase originals = cold rollback.
- Bot prerender (`functions/ssr-middleware.js`) serves full HTML to
  crawler UAs; humans get the SPA shell + age gate. GSC/Bing verified live.
- Founder verdicts (binding): prices/discounts(≤MRP)/reviews-as-service-proof/
  education OK; paid tobacco promotion never; pincode_lookup replaced by GPS
  (do not migrate); admin+finances migrate-but-never-redesign mid-migration.

## 2. Standing rules (earned the hard way)

- **External HTTP verification over internal tests.** Every claim ends in a
  `curl` against a running server (status/bytes/H1/schema), never a unit test.
  PowerShell mangles `curl.exe > file` to UTF-16 — convert before parsing.
- **Never trust agent self-reports.** Review every diff line; re-run checks.
  Stuck agents get 1 nudge, then I do it directly.
- **One plan-para first.** Every user prompt gets a short "here's what I'm
  about to do" before any tool call. No exceptions.
- **PowerShell quoting:** inline `python3 -c` with quotes/ampersands ALWAYS
  breaks — use script files in Temp. Same for complex `Select-String` patterns.
- **No partial hand-edits to large generated files.** `convex/schema.ts`
  clobbered 2026-09-11 by overlapping edits; restored from git. Append via
  unique anchors or rewrite whole file from a verified base.
- **Git transport stalls transiently** — retry with `-c http.version=HTTP/1.1`;
  `gh` CLI needs WRITE permission to push (READ fails with 404).
- **Cloudflare Bot Management 403s non-browser UAs** — server-side fetches
  must send a browser User-Agent. `curl -I` (HEAD) bypasses cache reporting;
  verify HITs with GET.
- **Secrets:** rotate Supabase keys if ever printed to logs; R2 tokens are
  single-use then deleted. Never commit `.env.local` / `.dev.vars` /
  `.wrangler/` (delete residue after local serving; kill orphan wrangler
  processes holding file locks).
- **Theme decoupling (AGENTS.md):** no Convex/Supabase imports in
  `src/themes/*` — all data via `src/hooks/data/`. Fix violations via hooks.
- **Checkout/address money-path: do not touch without E2E ability.**
  GPS fields, dual `addresses` table, untestable flows → defer, document why.
- **Supabase Auth enforces one user per phone** — same-number dual identity
  (consumer+admin) only possible AFTER our own JWT cutover.
- **No new pages while foundation unverified** (audit rule, still true).

## 3. Session notes (operational)

- Model: Muse Spark 1.3, 1M context. Session store queryable at
  `~/.local/share/opencode/opencode.db` (usage per message; ~52% at last check
  2026-09-11 — proxy, not a live meter). Auto-compaction ON (lossy) + `/compact`
  manual + `/undo` recovery. Tripwire is behavioral: re-asking settled
  questions = handoff time.
- Subagents: useful for bounded read-only scouts; rate limits hit 2026-09-11
  (wave executor failed) — fall back to direct execution, no heroics.
- Durable artifacts: `SEO Audits/` (reports+evidence, git-ignored),
  `CONVEX_MIGRATION_PLAN.md` (versioned), git log (push SHAs confirmed remote).
- Founder prefers: concise consent copy on gates (no extra popups), fresh
  starts over legacy preservation, CDN correctness over speed of cutover.
