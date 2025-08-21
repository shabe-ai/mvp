import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Process emails for all users with Google accounts connected
 * This is called by the cron job every 15 minutes
 * Note: This is a placeholder - actual email processing will be handled by API routes
 */
export const processEmailsForAllUsers = mutation({
  args: {},
  handler: async (ctx) => {
    try {
      console.log('Email processing cron job triggered - processing handled by API routes');
      
      // For now, just log that the cron job ran
      // Actual email processing is handled by the /api/email-monitor endpoint
      return {
        success: true,
        message: 'Email processing cron job completed - processing handled by API routes',
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Error in email processing cron job', error);
      throw error;
    }
  },
});

/**
 * Get email processing statistics for a user
 */
export const getEmailProcessingStats = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    try {
      // Get user's teams
      const teams = await ctx.db
        .query("teams")
        .filter((q) => q.eq(q.field("ownerId"), args.userId))
        .collect();

      if (teams.length === 0) {
        return { hasTeam: false, stats: null };
      }

      const teamId = teams[0]._id;

      // Get recent email activities
      const recentEmailActivities = await ctx.db
        .query("activities")
        .filter((q) => 
          q.and(
            q.eq(q.field("teamId"), teamId),
            q.eq(q.field("type"), "email"),
            q.gte(q.field("createdAt"), Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          )
        )
        .collect();

      const autoLoggedEmails = recentEmailActivities.filter(
        (activity) => activity.customFields?.autoLogged === true
      );

      return {
        hasTeam: true,
        stats: {
          totalEmailActivities: recentEmailActivities.length,
          autoLoggedEmails: autoLoggedEmails.length,
          manualLoggedEmails: recentEmailActivities.length - autoLoggedEmails.length,
          last24Hours: true
        }
      };

    } catch (error) {
      console.error('Error getting email processing stats', error);
      return { hasTeam: false, stats: null };
    }
  },
});

/**
 * Manually trigger email processing for a specific user
 * Note: This is a placeholder - actual processing handled by API routes
 */
export const triggerEmailProcessing = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    try {
      console.log('Manual email processing triggered', { userId: args.userId });

      // For now, just log the trigger
      // Actual processing is handled by the /api/email-monitor endpoint
      return {
        success: true,
        message: 'Email processing triggered - processing handled by API routes',
        userId: args.userId,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Error in manual email processing trigger', error);
      throw error;
    }
  },
});
