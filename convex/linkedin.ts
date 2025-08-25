import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

// ===== LINKEDIN INTEGRATION FUNCTIONS =====

export const createLinkedInIntegration = mutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    linkedinUserId: v.string(),
    linkedinPersonId: v.optional(v.string()),
    linkedinEmail: v.string(),
    linkedinName: v.string(),
    linkedinProfileUrl: v.optional(v.string()),
    linkedinOrganizationId: v.optional(v.string()),
    linkedinOrganizationName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      console.log("Creating LinkedIn integration for user:", args.userId);
      console.log("Team ID:", args.teamId);
      console.log("LinkedIn User ID:", args.linkedinUserId);
      console.log("LinkedIn Email:", args.linkedinEmail);
      console.log("LinkedIn Name:", args.linkedinName);

      // Deactivate any existing integrations for this user
      const existingIntegrations = await ctx.db
        .query("linkedinIntegrations")
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      console.log("Found existing integrations:", existingIntegrations.length);

      for (const integration of existingIntegrations) {
        await ctx.db.patch(integration._id, {
          isActive: false,
          updatedAt: Date.now(),
        });
      }

      // Create new integration
      const integrationData = {
        userId: args.userId,
        teamId: args.teamId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        linkedinUserId: args.linkedinUserId,
        linkedinPersonId: args.linkedinPersonId,
        linkedinEmail: args.linkedinEmail,
        linkedinName: args.linkedinName,
        linkedinProfileUrl: args.linkedinProfileUrl,
        linkedinOrganizationId: args.linkedinOrganizationId,
        linkedinOrganizationName: args.linkedinOrganizationName,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      console.log("Inserting integration data:", integrationData);

      const integrationId = await ctx.db.insert("linkedinIntegrations", integrationData);

      console.log("Successfully created LinkedIn integration with ID:", integrationId);

      return integrationId;
    } catch (error) {
      console.error("Error creating LinkedIn integration:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        args: args
      });
      throw new Error(`Failed to create LinkedIn integration: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

export const getLinkedInIntegration = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    try {
      const integration = await ctx.db
        .query("linkedinIntegrations")
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      return integration;
    } catch (error) {
      console.error("Error fetching LinkedIn integration:", error);
      return null;
    }
  },
});

export const updateLinkedInIntegration = mutation({
  args: {
    integrationId: v.id("linkedinIntegrations"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const deactivateLinkedInIntegration = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("linkedinIntegrations")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (integration) {
      await ctx.db.patch(integration._id, {
        isActive: false,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// ===== LINKEDIN POSTS FUNCTIONS =====

export const createLinkedInPost = mutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
    linkedinIntegrationId: v.id("linkedinIntegrations"),
    content: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    linkUrl: v.optional(v.string()),
    postType: v.union(
      v.literal("text"),
      v.literal("image"),
      v.literal("link"),
      v.literal("video")
    ),
    visibility: v.union(
      v.literal("public"),
      v.literal("connections"),
      v.literal("group")
    ),
    scheduledAt: v.optional(v.number()),
    aiGenerated: v.boolean(),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const postId = await ctx.db.insert("linkedinPosts", {
      userId: args.userId,
      teamId: args.teamId,
      linkedinIntegrationId: args.linkedinIntegrationId,
      content: args.content,
      title: args.title,
      description: args.description,
      imageUrl: args.imageUrl,
      linkUrl: args.linkUrl,
      postType: args.postType,
      visibility: args.visibility,
      scheduledAt: args.scheduledAt,
      status: args.scheduledAt ? "scheduled" : "draft",
      aiGenerated: args.aiGenerated,
      prompt: args.prompt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return postId;
  },
});

export const getLinkedInPosts = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    try {
      const posts = await ctx.db
        .query("linkedinPosts")
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .order("desc")
        .collect();

      return posts;
    } catch (error) {
      console.error("Error fetching LinkedIn posts:", error);
      return [];
    }
  },
});

export const updateLinkedInPost = mutation({
  args: {
    postId: v.id("linkedinPosts"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const deleteLinkedInPost = mutation({
  args: { postId: v.id("linkedinPosts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.postId);
    return { success: true };
  },
});

export const publishLinkedInPost = mutation({
  args: { postId: v.id("linkedinPosts") },
  handler: async (ctx, args) => {
    // This will be implemented with actual LinkedIn API call
    await ctx.db.patch(args.postId, {
      status: "published",
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ===== SCHEDULED POSTS FUNCTIONS =====

export const getScheduledPosts = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    let query = ctx.db
      .query("linkedinPosts")
      .filter((q) => q.eq(q.field("status"), "scheduled"))
      .filter((q) => q.lte(q.field("scheduledAt"), now));

    // If userId is provided, filter by user
    if (args.userId) {
      query = query.filter((q) => q.eq(q.field("userId"), args.userId));
    }

    const scheduledPosts = await query.collect();
    return scheduledPosts;
  },
});

export const scheduleLinkedInPost = mutation({
  args: {
    postId: v.id("linkedinPosts"),
    scheduledAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId, {
      status: "scheduled",
      scheduledAt: args.scheduledAt,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const publishScheduledPosts = action({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Get all scheduled posts that are due
    const scheduledPosts = await ctx.runQuery(api.linkedin.getScheduledPosts, { 
      userId: "system" // This will be filtered by the query
    });

    console.log(`Found ${scheduledPosts.length} scheduled posts to publish`);

    for (const post of scheduledPosts) {
      try {
        // Get the LinkedIn integration for this post
        const integration = await ctx.runQuery(api.linkedin.getLinkedInIntegration, { 
          userId: post.userId 
        });

        if (!integration) {
          console.error(`No LinkedIn integration found for user ${post.userId}`);
          continue;
        }

        // Check if access token is expired
        if (integration.expiresAt < now) {
          console.error(`LinkedIn access token expired for user ${post.userId}`);
          await ctx.runMutation(api.linkedin.updateLinkedInPost, {
            postId: post._id,
            updates: {
              status: 'failed',
              linkedinResponse: { error: 'Access token expired' },
            },
          });
          continue;
        }

        // TODO: Implement actual LinkedIn API call here
        // For now, just mark as published
        await ctx.runMutation(api.linkedin.updateLinkedInPost, {
          postId: post._id,
          updates: {
            status: 'published',
            publishedAt: now,
          },
        });

        console.log(`Published scheduled post ${post._id} for user ${post.userId}`);

      } catch (error) {
        console.error(`Error publishing scheduled post ${post._id}:`, error);
        
        // Mark post as failed
        await ctx.runMutation(api.linkedin.updateLinkedInPost, {
          postId: post._id,
          updates: {
            status: 'failed',
            linkedinResponse: { error: error instanceof Error ? error.message : 'Unknown error' },
          },
        });
      }
    }
  },
});
