import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { TokenStorage } from "../src/lib/tokenStorage";
import { getEmailMonitorService } from "../src/lib/emailMonitor";
import { logger } from "../src/lib/logger";

/**
 * Process emails for all users with Google accounts connected
 * This is called by the cron job every 15 minutes
 */
export const processEmailsForAllUsers = mutation({
  args: {},
  handler: async (ctx) => {
    try {
      logger.info('Starting scheduled email processing for all users');

      // Get all users with Google tokens
      const usersWithTokens = await TokenStorage.getAllUsersWithTokens();
      
      let totalProcessed = 0;
      let totalLogged = 0;
      let totalErrors = 0;

      for (const userId of usersWithTokens) {
        try {
          const emailMonitor = await getEmailMonitorService(userId);
          if (!emailMonitor) {
            continue;
          }

          const result = await emailMonitor.processRecentEmails(userId);
          
          totalProcessed += result.processed;
          totalLogged += result.logged;
          totalErrors += result.errors;

          logger.info('Email processing completed for user', {
            userId,
            processed: result.processed,
            logged: result.logged,
            errors: result.errors
          });

        } catch (error) {
          totalErrors++;
          logger.error('Error processing emails for user', error instanceof Error ? error : new Error(String(error)), {
            userId
          });
        }
      }

      logger.info('Scheduled email processing completed for all users', {
        totalProcessed,
        totalLogged,
        totalErrors,
        usersProcessed: usersWithTokens.length
      });

      return {
        success: true,
        totalProcessed,
        totalLogged,
        totalErrors,
        usersProcessed: usersWithTokens.length
      };

    } catch (error) {
      logger.error('Error in scheduled email processing', error instanceof Error ? error : new Error(String(error)));
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
      logger.error('Error getting email processing stats', error instanceof Error ? error : new Error(String(error)), {
        userId: args.userId
      });
      return { hasTeam: false, stats: null };
    }
  },
});

/**
 * Manually trigger email processing for a specific user
 */
export const triggerEmailProcessing = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    try {
      logger.info('Manual email processing triggered', { userId: args.userId });

      const emailMonitor = await getEmailMonitorService(args.userId);
      if (!emailMonitor) {
        throw new Error("Google account not connected");
      }

      const result = await emailMonitor.processRecentEmails(args.userId);

      logger.info('Manual email processing completed', {
        userId: args.userId,
        processed: result.processed,
        logged: result.logged,
        errors: result.errors
      });

      return {
        success: true,
        processed: result.processed,
        logged: result.logged,
        errors: result.errors
      };

    } catch (error) {
      logger.error('Error in manual email processing', error instanceof Error ? error : new Error(String(error)), {
        userId: args.userId
      });
      throw error;
    }
  },
});
