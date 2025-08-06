import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Store cost tracking data
export const storeCostData = mutation({
  args: {
    userId: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cost: v.number(),
    operation: v.string(),
  },
  handler: async (ctx, args) => {
    const costId = await ctx.db.insert("costTracking", {
      userId: args.userId,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      cost: args.cost,
      operation: args.operation,
      timestamp: Date.now(),
    });

    console.log(`💰 Cost tracked: User ${args.userId} - Model: ${args.model}, Cost: $${args.cost.toFixed(4)}`);
    return costId;
  },
});

// Get cost statistics for a user
export const getCostStats = query({
  args: {
    userId: v.optional(v.string()),
    timeWindow: v.optional(v.number()), // in milliseconds
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const window = args.timeWindow || 24 * 60 * 60 * 1000; // Default to 24 hours
    
    let costRecords;
    
    if (args.userId) {
      costRecords = await ctx.db
        .query("costTracking")
        .withIndex("by_user_and_time", (q) => 
          q.eq("userId", args.userId!).gte("timestamp", now - window)
        )
        .collect();
    } else {
      costRecords = await ctx.db
        .query("costTracking")
        .withIndex("by_time", (q) => q.gte("timestamp", now - window))
        .collect();
    }

    const totalCost = costRecords.reduce((sum, record) => sum + record.cost, 0);
    const totalRequests = costRecords.length;
    const averageCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;

    const costByModel: Record<string, number> = {};
    costRecords.forEach(record => {
      costByModel[record.model] = (costByModel[record.model] || 0) + record.cost;
    });

    return {
      totalCost,
      totalRequests,
      averageCostPerRequest,
      costByModel,
      timeWindow: window,
    };
  },
});

// Get rate limit status
export const getRateLimitStatus = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Get user's recent requests
    const recentRequests = await ctx.db
      .query("rateLimitTracking")
      .withIndex("by_user_and_time", (q) => 
        q.eq("userId", args.userId).gte("timestamp", now - 24 * 60 * 60 * 1000)
      )
      .collect();

    // Calculate limits
    const minuteRequests = recentRequests.filter(r => now - r.timestamp <= 60 * 1000).length;
    const hourRequests = recentRequests.filter(r => now - r.timestamp <= 60 * 60 * 1000).length;
    const dayRequests = recentRequests.filter(r => now - r.timestamp <= 24 * 60 * 60 * 1000).length;

    return {
      userLimits: {
        minute: { count: minuteRequests, limit: 10, remaining: Math.max(0, 10 - minuteRequests) },
        hour: { count: hourRequests, limit: 100, remaining: Math.max(0, 100 - hourRequests) },
        day: { count: dayRequests, limit: 1000, remaining: Math.max(0, 1000 - dayRequests) },
      },
    };
  },
});

// Store rate limit tracking
export const storeRateLimitData = mutation({
  args: {
    userId: v.string(),
    operation: v.string(),
  },
  handler: async (ctx, args) => {
    const rateLimitId = await ctx.db.insert("rateLimitTracking", {
      userId: args.userId,
      operation: args.operation,
      timestamp: Date.now(),
    });

    return rateLimitId;
  },
}); 