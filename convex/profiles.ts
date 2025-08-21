import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== USER PROFILE FUNCTIONS =====

export const createUserProfile = mutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    department: v.optional(v.string()),
    bio: v.optional(v.string()),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()),
    dateFormat: v.optional(v.string()),
    communicationStyle: v.optional(v.union(
      v.literal("formal"),
      v.literal("casual"),
      v.literal("friendly"),
      v.literal("professional")
    )),
    preferredDetailLevel: v.optional(v.union(
      v.literal("brief"),
      v.literal("detailed"),
      v.literal("comprehensive")
    )),
    responseLength: v.optional(v.union(
      v.literal("short"),
      v.literal("medium"),
      v.literal("long")
    )),
    humorPreference: v.optional(v.union(
      v.literal("none"),
      v.literal("light"),
      v.literal("moderate")
    )),
    emojiUsage: v.optional(v.union(
      v.literal("none"),
      v.literal("minimal"),
      v.literal("moderate"),
      v.literal("frequent")
    )),
    role: v.optional(v.string()),
    responsibilities: v.optional(v.array(v.string())),
    targetIndustries: v.optional(v.array(v.string())),
    targetCompanySizes: v.optional(v.array(v.string())),
    customFields: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const profileId = await ctx.db.insert("userProfiles", {
      userId: args.userId,
      teamId: args.teamId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      title: args.title,
      department: args.department,
      bio: args.bio,
      timezone: args.timezone,
      language: args.language,
      dateFormat: args.dateFormat,
      communicationStyle: args.communicationStyle,
      preferredDetailLevel: args.preferredDetailLevel,
      responseLength: args.responseLength,
      humorPreference: args.humorPreference,
      emojiUsage: args.emojiUsage,
      role: args.role,
      responsibilities: args.responsibilities,
      targetIndustries: args.targetIndustries,
      targetCompanySizes: args.targetCompanySizes,
      customFields: args.customFields || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return profileId;
  },
});

export const getUserProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    return profile;
  },
});

export const updateUserProfile = mutation({
  args: {
    userId: v.string(),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    
    if (!profile) {
      throw new Error("User profile not found");
    }
    
    await ctx.db.patch(profile._id, {
      ...args.updates,
      updatedAt: Date.now(),
    });
    
    return profile._id;
  },
});

// ===== COMPANY PROFILE FUNCTIONS =====

export const createCompanyProfile = mutation({
  args: {
    teamId: v.string(),
    ownerId: v.string(),
    name: v.string(),
    website: v.optional(v.string()),
    description: v.optional(v.string()),
    industry: v.optional(v.string()),
    founded: v.optional(v.number()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.any()),
    companySize: v.optional(v.union(
      v.literal("1-10"),
      v.literal("11-50"),
      v.literal("51-200"),
      v.literal("201-1000"),
      v.literal("1000+")
    )),
    annualRevenue: v.optional(v.union(
      v.literal("<$1M"),
      v.literal("$1M-$10M"),
      v.literal("$10M-$100M"),
      v.literal("$100M+")
    )),
    businessModel: v.optional(v.string()),
    targetMarket: v.optional(v.string()),
    currentCrm: v.optional(v.string()),
    painPoints: v.optional(v.array(v.string())),
    goals: v.optional(v.array(v.string())),
    teamSize: v.optional(v.number()),
    logo: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    brandVoice: v.optional(v.string()),
    customFields: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const profileId = await ctx.db.insert("companyProfiles", {
      teamId: args.teamId,
      ownerId: args.ownerId,
      name: args.name,
      website: args.website,
      description: args.description,
      industry: args.industry,
      founded: args.founded,
      email: args.email,
      phone: args.phone,
      address: args.address,
      companySize: args.companySize,
      annualRevenue: args.annualRevenue,
      businessModel: args.businessModel,
      targetMarket: args.targetMarket,
      currentCrm: args.currentCrm,
      painPoints: args.painPoints,
      goals: args.goals,
      teamSize: args.teamSize,
      logo: args.logo,
      primaryColor: args.primaryColor,
      brandVoice: args.brandVoice,
      customFields: args.customFields || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return profileId;
  },
});

export const getCompanyProfile = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("companyProfiles")
      .filter((q) => q.eq(q.field("teamId"), args.teamId))
      .first();
    return profile;
  },
});

export const updateCompanyProfile = mutation({
  args: {
    teamId: v.string(),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("companyProfiles")
      .filter((q) => q.eq(q.field("teamId"), args.teamId))
      .first();
    
    if (!profile) {
      throw new Error("Company profile not found");
    }
    
    await ctx.db.patch(profile._id, {
      ...args.updates,
      updatedAt: Date.now(),
    });
    
    return profile._id;
  },
});

// ===== COMBINED PROFILE FUNCTIONS =====

export const getCompleteProfile = query({
  args: { userId: v.string(), teamId: v.string() },
  handler: async (ctx, args) => {
    const userProfile = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    
    const companyProfile = await ctx.db
      .query("companyProfiles")
      .filter((q) => q.eq(q.field("teamId"), args.teamId))
      .first();
    
    return {
      user: userProfile,
      company: companyProfile,
    };
  },
});

// ===== AI CONTEXT FUNCTIONS =====

export const getAIProfileContext = query({
  args: { userId: v.string(), teamId: v.string() },
  handler: async (ctx, args) => {
    const userProfile = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    
    const companyProfile = await ctx.db
      .query("companyProfiles")
      .filter((q) => q.eq(q.field("teamId"), args.teamId))
      .first();
    
    // Format for AI context
    const aiContext = {
      user: userProfile ? {
        name: `${userProfile.firstName} ${userProfile.lastName}`,
        email: userProfile.email,
        title: userProfile.title,
        department: userProfile.department,
        role: userProfile.role,
        communicationStyle: userProfile.communicationStyle,
        preferredDetailLevel: userProfile.preferredDetailLevel,
        responseLength: userProfile.responseLength,
        humorPreference: userProfile.humorPreference,
        emojiUsage: userProfile.emojiUsage,
        targetIndustries: userProfile.targetIndustries,
        targetCompanySizes: userProfile.targetCompanySizes,
        responsibilities: userProfile.responsibilities,
      } : null,
      company: companyProfile ? {
        name: companyProfile.name,
        industry: companyProfile.industry,
        companySize: companyProfile.companySize,
        annualRevenue: companyProfile.annualRevenue,
        businessModel: companyProfile.businessModel,
        targetMarket: companyProfile.targetMarket,
        currentCrm: companyProfile.currentCrm,
        painPoints: companyProfile.painPoints,
        goals: companyProfile.goals,
        teamSize: companyProfile.teamSize,
        brandVoice: companyProfile.brandVoice,
      } : null,
    };
    
    return aiContext;
  },
});
