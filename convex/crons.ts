import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Run email monitoring every 15 minutes
crons.interval(
  "email monitoring",
  { minutes: 15 },
  api.emailMonitor.processEmailsForAllUsers
);

export default crons;
