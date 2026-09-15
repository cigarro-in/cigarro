import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Gmail OAuth poller — the single payment-verification feed. Polls every
// 5 minutes; idle-skips when no org has pending orders. No-ops until the
// founder completes the OAuth dance (env secrets) and enables polling in
// Payment Settings.
crons.interval("gmail inbox poll", { minutes: 5 }, internal.gmail.pollInbox, {});

export default crons;
