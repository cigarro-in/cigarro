import { cronJobs, makeFunctionReference } from "convex/server";
import { internal } from './_generated/api';

const crons = cronJobs();
crons.interval('prune crash logs', { hours: 6 }, internal.crashLogs.prune, {});

// Custom-domain health (convex/domains.ts monitor): non-active domains every
// tick, active domains every 6h.
const monitorDomainsRef = makeFunctionReference<"action">("domains:monitor");
crons.interval("monitor domains", { minutes: 15 }, monitorDomainsRef, {});

// Gmail inbox checks are event-driven per order (creation
// backoff, customer wake/refresh, post-expiry reconciliation) plus manual
// admin checks — each skips with zero Gmail calls when nothing is pending.

export default crons;
