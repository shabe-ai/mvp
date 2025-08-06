import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Daily usage snapshot
export const createDailySnapshot = action({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    try {
      // Get cost statistics for the last 24 hours
      const costStats = await ctx.runQuery(api.monitoring.getCostStats, {
        timeWindow: 24 * 60 * 60 * 1000,
      });

      // Get rate limit statistics
      const rateLimitStats = await ctx.runQuery(api.analytics.getRateLimitStats, {
        timeWindow: 24 * 60 * 60 * 1000,
      });

      // Get user activity statistics
      const userStats = await ctx.runQuery(api.analytics.getUserActivityStats, {
        timeWindow: 24 * 60 * 60 * 1000,
      });

      // Create daily snapshot
      await ctx.runMutation(api.analytics.storeDailySnapshot, {
        date: new Date().toISOString().split('T')[0],
        timestamp: now,
        costStats,
        rateLimitStats,
        userStats,
      });

      console.log('📊 Daily snapshot created successfully');
    } catch (error) {
      console.error('❌ Error creating daily snapshot:', error);
    }
  },
});

// Get rate limit statistics
export const getRateLimitStats = query({
  args: {
    timeWindow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const window = args.timeWindow || 24 * 60 * 60 * 1000;
    
    const recentRequests = await ctx.db
      .query("rateLimitTracking")
      .withIndex("by_time", (q) => q.gte("timestamp", now - window))
      .collect();

    const totalRequests = recentRequests.length;
    const uniqueUsers = new Set(recentRequests.map(r => r.userId)).size;
    const requestsByOperation = recentRequests.reduce((acc, req) => {
      acc[req.operation] = (acc[req.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRequests,
      uniqueUsers,
      requestsByOperation,
      timeWindow: window,
    };
  },
});

// Get user activity statistics
export const getUserActivityStats = query({
  args: {
    timeWindow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const window = args.timeWindow || 24 * 60 * 60 * 1000;
    
    // Get all teams created in the time window
    const teams = await ctx.db
      .query("teams")
      .filter((q) => q.gte(q.field("createdAt"), now - window))
      .collect();

    // Get all contacts created in the time window
    const contacts = await ctx.db
      .query("contacts")
      .filter((q) => q.gte(q.field("createdAt"), now - window))
      .collect();

    // Get all activities created in the time window
    const activities = await ctx.db
      .query("activities")
      .filter((q) => q.gte(q.field("createdAt"), now - window))
      .collect();

    // Get all deals created in the time window
    const deals = await ctx.db
      .query("deals")
      .filter((q) => q.gte(q.field("createdAt"), now - window))
      .collect();

    return {
      teamsCreated: teams.length,
      contactsCreated: contacts.length,
      activitiesCreated: activities.length,
      dealsCreated: deals.length,
      timeWindow: window,
    };
  },
});

// Store daily snapshot
export const storeDailySnapshot = mutation({
  args: {
    date: v.string(),
    timestamp: v.number(),
    costStats: v.any(),
    rateLimitStats: v.any(),
    userStats: v.any(),
  },
  handler: async (ctx, args) => {
    const snapshotId = await ctx.db.insert("dailySnapshots", {
      date: args.date,
      timestamp: args.timestamp,
      costStats: args.costStats,
      rateLimitStats: args.rateLimitStats,
      userStats: args.userStats,
    });

    console.log(`📊 Daily snapshot stored with ID: ${snapshotId}`);
    return snapshotId;
  },
}); 