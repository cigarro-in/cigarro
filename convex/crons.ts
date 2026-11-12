import { cronJobs, makeFunctionReference } from "convex/server";
import { internal } from './_generated/api';

const crons = cronJobs();
crons.interval('prune crash logs', { hours: 6 }, internal.crashLogs.prune, {});

// Runs one-time data migrations (convex/migrations.ts). Referenced by path: the
// generated api.d.ts lists modules only after codegen.
const runPendingMigrationsRef = makeFunctionReference<"action">("migrations:runPending");
crons.interval("run pending migrations", { minutes: 10 }, runPendingMigrationsRef, {});

// Gmail inbox checks are event-driven per order (creation
// backoff, customer wake/refresh, post-expiry reconciliation) plus manual
// admin checks — each skips with zero Gmail calls when nothing is pending.

export default crons;
