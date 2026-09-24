// Focused checks for the event-driven Gmail polling model.
// Run: npx tsx scripts/verify-gmail-polling.ts
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ORDER_POLL_EARLY_OFFSETS_MS,
  ORDER_POLL_STEADY_MS,
  RECONCILE_OFFSETS_MS,
  TERMINAL_ORDER_STATUSES,
  buildOrderPollOffsets,
  isTerminalOrderStatus,
} from "../convex/lib/pollSchedule";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// --- Schedule shape: fixed backoff, no statistical adaptation ---
check(
  "early backoff is exactly 5s,12s,25s,45s,75s,120s",
  eq(ORDER_POLL_EARLY_OFFSETS_MS, [5_000, 12_000, 25_000, 45_000, 75_000, 120_000]),
);
check("steady cadence is 60s", ORDER_POLL_STEADY_MS === 60_000);
check(
  "10-min timeout yields early + 180s..600s steady",
  eq(buildOrderPollOffsets(600_000), [
    5_000, 12_000, 25_000, 45_000, 75_000, 120_000,
    180_000, 240_000, 300_000, 360_000, 420_000, 480_000, 540_000, 600_000,
  ]),
);
check(
  "short timeout drops early offsets past the timeout",
  eq(buildOrderPollOffsets(60_000), [5_000, 12_000, 25_000, 45_000]),
);
check(
  "non-positive timeout yields no offsets (no window, no checks)",
  eq(buildOrderPollOffsets(0), []) &&
    eq(buildOrderPollOffsets(-1_000), []) &&
    eq(buildOrderPollOffsets(Number.NaN), []),
);
check(
  "exact boundary kept (5s timeout keeps the 5s check)",
  eq(buildOrderPollOffsets(5_000), [5_000]),
);
check(
  "no offset ever exceeds its timeout",
  [30_000, 60_000, 100_000, 300_000, 600_000].every((t) =>
    buildOrderPollOffsets(t).every((o) => o <= t),
  ),
);
check("reconcile is sparse (2 checks)", RECONCILE_OFFSETS_MS.length === 2);

// --- Terminal set stops active checks ---
check(
  "terminal set covers paid/late_paid/cancelled/expired/refunded/voided",
  eq([...TERMINAL_ORDER_STATUSES].sort(), [
    "cancelled", "expired", "late_paid", "paid", "refunded", "voided",
  ]),
);
check("pending is not terminal", !isTerminalOrderStatus("pending"));

// --- Static wiring checks ---
const crons = read("convex/crons.ts");
check("no permanent cron", !crons.includes("interval("));
check("no gmail poll target in crons", !crons.includes("pollInbox"));

const gmail = read("convex/gmail.ts");
check("no gmailPollEnabled behavior in gmail.ts", !gmail.includes("gmailPollEnabled"));
check("no poll-disabled gate in gmail.ts", !gmail.includes("poll disabled"));
check("order-scoped terminal guard present", gmail.includes("order_terminal"));
check("no-pending guard present", gmail.includes("no_pending_orders"));
check("reconcile reason supported", gmail.includes('"reconcile"'));
check("wake restarts backoff bounded to remaining timeout", gmail.includes("buildOrderPollOffsets") && gmail.includes("remaining"));
check("manual check preserved", gmail.includes("triggerPoll"));

const orders = read("convex/orders.ts");
check("createOrder uses backoff builder", orders.includes("buildOrderPollOffsets"));
check("createOrder passes orderId to checks", orders.includes("orderId,"));
check("creation chain carries generation", orders.includes("generation"));

// --- Generation/epoch invalidation: wake restarts must retire the creation chain ---
check("pollInbox accepts generation", /generation:\s*v\.optional\(v\.number\(\)\)/.test(gmail));
check("stale scheduled jobs exit pre-API", gmail.includes("stale_generation") && gmail.indexOf("stale_generation") < gmail.indexOf("/users/me/messages"));
check("stale guard spares manual + reconcile", /mode !== "manual"[\s\S]*?mode !== "reconcile"[\s\S]*?stale_generation/.test(gmail));
check("wake bumps generation", gmail.includes("pollGeneration"));
check("restart chain carries new generation", /generation:\s*nextGen/.test(gmail));
check(
  "fresh-order wake skips re-arm (creation chain already covers to expiry)",
  gmail.includes("now - order.createdAt < WAKE_THROTTLE_MS"),
);
check(
  "fresh-order wake still runs one immediate check on the current epoch",
  /generation: order\.pollGeneration \?\? 0/.test(gmail),
);
check("order state exposes generation", gmail.includes("generation: order.pollGeneration"));

const payments = read("convex/payments.ts");
check("expiry schedules reconcile", payments.includes('reason: "reconcile"'));

const schema = read("convex/schema.ts");
check("legacy schema field kept optional", schema.includes("gmailPollEnabled: v.optional(v.boolean())"));
check("generation field in schema", schema.includes("pollGeneration"));

const page = read("src/adminnew/pages/PaymentsPage.tsx");
check("no polling toggle in admin UI", !page.includes("onToggle") && !page.includes("Poll every"));
check("no every-5-minutes copy in admin UI", !page.includes("every\n") && !page.includes("5 minutes"));

const http = read("convex/http.ts");
check("no flip-on-polling OAuth copy", !http.includes("flip on polling"));

if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("all gmail polling checks passed");
