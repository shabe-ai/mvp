import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== LINKEDIN INTEGRATION FUNCTIONS =====

export const createLinkedInIntegration = mutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    linkedinUserId: v.string(),
    linkedinEmail: v.string(),
    linkedinName: v.string(),
    linkedinProfileUrl: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    organizationName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const integrationId = await ctx.db.insert("linkedinIntegrations", {
      userId: args.userId,
      teamId: args.teamId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      linkedinUserId: args.linkedinUserId,
      linkedinEmail: args.linkedinEmail,
      linkedinName: args.linkedinName,
      linkedinProfileUrl: args.linkedinProfileUrl,
      organizationId: args.organizationId,
      organizationName: args.organizationName,
      isActive: true,
      lastSyncAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return integrationId;
  },
});

export const getLinkedInIntegration = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("linkedinIntegrations")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    return integration;
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
  args: { 
    userId: v.string(),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("published"),
      v.literal("failed")
    )),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("linkedinPosts")
      .filter((q) => q.eq(q.field("userId"), args.userId));

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    const posts = await query.order("desc").collect();
    return posts;
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
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const scheduledPosts = await ctx.db
      .query("linkedinPosts")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .filter((q) => q.eq(q.field("status"), "scheduled"))
      .filter((q) => q.lte(q.field("scheduledAt"), now))
      .collect();

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
