import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { enrichContact, enrichAccount } from "./enrich";
import { api } from "./_generated/api";

// ===== TEAM FUNCTIONS =====

export const createTeam = mutation({
  args: {
    name: v.string(),
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      ownerId: args.ownerId,
      members: [args.ownerId],
      settings: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return teamId;
  },
});

export const getTeamsByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teams")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();
  },
});

export const getTeamById = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.teamId);
  },
});

export const updateTeam = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    await ctx.db.patch(args.teamId, {
      ...(args.name && { name: args.name }),
      ...(args.settings && { settings: args.settings }),
      updatedAt: Date.now(),
    });
  },
});

export const addTeamMember = mutation({
  args: {
    teamId: v.id("teams"),
    memberId: v.string(),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    if (!team.members.includes(args.memberId)) {
      await ctx.db.patch(args.teamId, {
        members: [...team.members, args.memberId],
        updatedAt: Date.now(),
      });
    }
  },
});

export const removeTeamMember = mutation({
  args: {
    teamId: v.id("teams"),
    memberId: v.string(),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    if (team.ownerId === args.memberId) {
      throw new Error("Cannot remove team owner");
    }

    await ctx.db.patch(args.teamId, {
      members: team.members.filter(id => id !== args.memberId),
      updatedAt: Date.now(),
    });
  },
});

export const getTeamStats = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    const deals = await ctx.db
      .query("deals")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    return {
      contacts: contacts.length,
      accounts: accounts.length,
      activities: activities.length,
      deals: deals.length,
      totalRecords: contacts.length + accounts.length + activities.length + deals.length,
    };
  },
});

// ===== CONTACT FUNCTIONS =====

export const createContact = mutation({
  args: {
    teamId: v.string(),
    createdBy: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    accountId: v.optional(v.id("accounts")),
    leadStatus: v.union(
      v.literal("new"),
      v.literal("contacted"),
      v.literal("qualified"),
      v.literal("unqualified")
    ),
    contactType: v.union(v.literal("lead"), v.literal("contact")),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    customFields: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const contactId = await ctx.db.insert("contacts", {
      teamId: args.teamId,
      createdBy: args.createdBy,
      sharedWith: [args.createdBy],
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      title: args.title,
      company: args.company,
      accountId: args.accountId,
      leadStatus: args.leadStatus,
      contactType: args.contactType,
      source: args.source,
      notes: args.notes,
      customFields: args.customFields || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    // Schedule enrichment after creation
    await ctx.scheduler.runAfter(0, api.enrich.enrichContact, { contactId });
    return contactId;
  },
});

export const getContactsByTeam = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contacts")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
  },
});

export const getContactById = query({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contactId);
  },
});

export const updateContact = mutation({
  args: {
    contactId: v.id("contacts"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      ...args.updates,
      updatedAt: Date.now(),
    });
  },
});

export const deleteContact = mutation({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.contactId);
  },
});

// ===== ACCOUNT FUNCTIONS =====

export const createAccount = mutation({
  args: {
    teamId: v.string(),
    createdBy: v.string(),
    name: v.string(),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.any()),
    annualRevenue: v.optional(v.number()),
    employeeCount: v.optional(v.number()),
    notes: v.optional(v.string()),
    customFields: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const accountId = await ctx.db.insert("accounts", {
      teamId: args.teamId,
      createdBy: args.createdBy,
      sharedWith: [args.createdBy],
      name: args.name,
      industry: args.industry,
      website: args.website,
      phone: args.phone,
      address: args.address,
      annualRevenue: args.annualRevenue,
      employeeCount: args.employeeCount,
      notes: args.notes,
      customFields: args.customFields || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    // Schedule enrichment after creation
    await ctx.scheduler.runAfter(0, api.enrich.enrichAccount, { accountId });
    return accountId;
  },
});

export const getAccountsByTeam = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accounts")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
  },
});

export const getAccountById = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.accountId);
  },
});

export const updateAccount = mutation({
  args: {
    accountId: v.id("accounts"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      ...args.updates,
      updatedAt: Date.now(),
    });
  },
});

export const deleteAccount = mutation({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.accountId);
  },
});

// ===== ACTIVITY FUNCTIONS =====

export const createActivity = mutation({
  args: {
    teamId: v.string(),
    createdBy: v.string(),
    type: v.union(
      v.literal("email"),
      v.literal("event"),
      v.literal("call"),
      v.literal("meeting")
    ),
    subject: v.string(),
    description: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    accountId: v.optional(v.id("accounts")),
    dealId: v.optional(v.id("deals")),
    status: v.union(
      v.literal("scheduled"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    attendees: v.optional(v.array(v.string())),
    customFields: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const activityId = await ctx.db.insert("activities", {
      teamId: args.teamId,
      createdBy: args.createdBy,
      sharedWith: [args.createdBy],
      type: args.type,
      subject: args.subject,
      description: args.description,
      contactId: args.contactId,
      accountId: args.accountId,
      dealId: args.dealId,
      status: args.status,
      startTime: args.startTime,
      endTime: args.endTime,
      attendees: args.attendees,
      customFields: args.customFields || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return activityId;
  },
});

export const getActivitiesByTeam = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("activities")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
  },
});

export const getActivityById = query({
  args: { activityId: v.id("activities") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.activityId);
  },
});

export const updateActivity = mutation({
  args: {
    activityId: v.id("activities"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.activityId, {
      ...args.updates,
      updatedAt: Date.now(),
    });
  },
});

export const deleteActivity = mutation({
  args: { activityId: v.id("activities") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.activityId);
  },
});

// ===== DEAL FUNCTIONS =====

export const createDeal = mutation({
  args: {
    teamId: v.string(),
    createdBy: v.string(),
    name: v.string(),
    contactId: v.optional(v.id("contacts")),
    accountId: v.optional(v.id("accounts")),
    stage: v.union(
      v.literal("prospecting"),
      v.literal("qualification"),
      v.literal("proposal"),
      v.literal("negotiation"),
      v.literal("closed_won"),
      v.literal("closed_lost")
    ),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    closeDate: v.optional(v.number()),
    probability: v.optional(v.number()),
    description: v.optional(v.string()),
    customFields: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const dealId = await ctx.db.insert("deals", {
      teamId: args.teamId,
      createdBy: args.createdBy,
      sharedWith: [args.createdBy],
      name: args.name,
      contactId: args.contactId,
      accountId: args.accountId,
      stage: args.stage,
      amount: args.amount,
      currency: args.currency,
      closeDate: args.closeDate,
      probability: args.probability,
      description: args.description,
      customFields: args.customFields || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return dealId;
  },
});

export const getDealsByTeam = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deals")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
  },
});

export const getDealById = query({
  args: { dealId: v.id("deals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.dealId);
  },
});

export const updateDeal = mutation({
  args: {
    dealId: v.id("deals"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.dealId, {
      ...args.updates,
      updatedAt: Date.now(),
    });
  },
});

export const deleteDeal = mutation({
  args: { dealId: v.id("deals") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.dealId);
  },
});

// ===== LOG FUNCTIONS =====

export const createLog = mutation({
  args: {
    teamId: v.string(),
    createdBy: v.string(),
    message: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    relatedContactId: v.optional(v.id("contacts")),
    relatedAccountId: v.optional(v.id("accounts")),
    relatedDealId: v.optional(v.id("deals")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("logs", {
      teamId: args.teamId,
      createdBy: args.createdBy,
      sharedWith: [args.createdBy],
      message: args.message,
      role: args.role,
      relatedContactId: args.relatedContactId,
      relatedAccountId: args.relatedAccountId,
      relatedDealId: args.relatedDealId,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
    return logId;
  },
});

export const getLogsByTeam = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("logs")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .collect();
  },
});

// ===== CUSTOM FIELD FUNCTIONS =====

export const addCustomField = mutation({
  args: {
    teamId: v.string(),
    objectType: v.union(
      v.literal("contacts"),
      v.literal("accounts"),
      v.literal("activities"),
      v.literal("deals")
    ),
    fieldName: v.string(),
    fieldType: v.union(
      v.literal("text"),
      v.literal("number"),
      v.literal("date"),
      v.literal("boolean"),
      v.literal("dropdown")
    ),
    fieldOptions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const fieldId = await ctx.db.insert("customFieldDefinitions", {
      teamId: args.teamId,
      objectType: args.objectType,
      fieldName: args.fieldName,
      fieldType: args.fieldType,
      fieldOptions: args.fieldOptions,
      createdAt: Date.now(),
    });
    return fieldId;
  },
});

export const getCustomFieldsByTeam = query({
  args: { 
    teamId: v.string(),
    objectType: v.union(
      v.literal("contacts"),
      v.literal("accounts"),
      v.literal("activities"),
      v.literal("deals")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customFieldDefinitions")
      .withIndex("by_team_and_object", (q) => 
        q.eq("teamId", args.teamId).eq("objectType", args.objectType)
      )
      .collect();
  },
});

// ===== ACCOUNT FIELD FUNCTIONS =====

export const addAccountField = mutation({
  args: {
    teamId: v.string(),
    accountId: v.id("accounts"),
    fieldName: v.string(),
    fieldValue: v.any(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }
    
    const customFields = account.customFields || {};
    customFields[args.fieldName] = args.fieldValue;
    
    await ctx.db.patch(args.accountId, {
      customFields,
      updatedAt: Date.now(),
    });
    
    return { message: `✅ Custom field '${args.fieldName}' added to account successfully.` };
  },
});

// ===== ACTIVITY FIELD FUNCTIONS =====

export const addActivityField = mutation({
  args: {
    teamId: v.string(),
    activityId: v.id("activities"),
    fieldName: v.string(),
    fieldValue: v.any(),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }
    
    const customFields = activity.customFields || {};
    customFields[args.fieldName] = args.fieldValue;
    
    await ctx.db.patch(args.activityId, {
      customFields,
      updatedAt: Date.now(),
    });
    
    return { message: `✅ Custom field '${args.fieldName}' added to activity successfully.` };
  },
});

// ===== DEAL FIELD FUNCTIONS =====

export const addDealField = mutation({
  args: {
    teamId: v.string(),
    dealId: v.id("deals"),
    fieldName: v.string(),
    fieldValue: v.any(),
  },
  handler: async (ctx, args) => {
    const deal = await ctx.db.get(args.dealId);
    if (!deal) {
      throw new Error("Deal not found");
    }
    
    const customFields = deal.customFields || {};
    customFields[args.fieldName] = args.fieldValue;
    
    await ctx.db.patch(args.dealId, {
      customFields,
      updatedAt: Date.now(),
    });
    
    return { message: `✅ Custom field '${args.fieldName}' added to deal successfully.` };
  },
}); 