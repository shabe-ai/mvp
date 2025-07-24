import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "http://localhost:3210";
const convex = new ConvexHttpClient(convexUrl);

async function main() {
  // Use actual userId and teamId from user
  const userId = "user_3042sPD7bBdcCjuw4gX6lAGFbkS";
  const teamId = "jx7e02h2edxjt9yg4nerfza7rs7m39ns";

  console.log("Seeding data for teamId:", teamId, "userId:", userId);
  const result = await convex.mutation(api.seed.seedSampleData, { teamId, userId });
  console.log("Seed result:", result);
}

main().catch((err) => {
  console.error("Seed script error:", err);
  process.exit(1);
}); 