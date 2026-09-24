import { cronJobs } from "convex/server";

const crons = cronJobs();

// No permanent cron. Gmail inbox checks are event-driven per order (creation
// backoff, customer wake/refresh, post-expiry reconciliation) plus manual
// admin checks — each skips with zero Gmail calls when nothing is pending.

export default crons;
