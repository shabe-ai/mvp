import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Email monitoring - runs every 15 minutes
crons.interval(
  "Process emails for all users",
  { minutes: 15 },
  api.emailMonitor.processEmailsForAllUsers
);

// LinkedIn post publishing - runs every 5 minutes
crons.interval(
  "Publish scheduled LinkedIn posts",
  { minutes: 5 },
  api.linkedin.publishScheduledPosts
);

export default crons;
