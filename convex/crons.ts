import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily 2 AM IST sweep — one GAS call per configured org to reconcile
// any orphan or late-arriving emails. IST = UTC+5:30, so 2 AM IST = 20:30 UTC.
crons.daily(
  "daily bank-email sweep",
  { hourUTC: 20, minuteUTC: 30 },
  internal.scheduler.dailySweepAll,
);

export default crons;
