import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const seedSampleData = mutation({
  args: {
    teamId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { teamId, userId } = args;

    // Create sample accounts
    const account1 = await ctx.db.insert("accounts", {
      teamId,
      createdBy: userId,
      sharedWith: [userId],
      name: "Acme Corporation",
      industry: "Technology",
      website: "https://acme.com",
      phone: "+1-555-0123",
      address: {
        street: "123 Tech Street",
        city: "San Francisco",
        state: "CA",
        zip: "94105",
        country: "USA",
      },
      annualRevenue: 5000000,
      employeeCount: 250,
      notes: "Leading technology company",
      customFields: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const account2 = await ctx.db.insert("accounts", {
      teamId,
      createdBy: userId,
      sharedWith: [userId],
      name: "Global Solutions Inc",
      industry: "Consulting",
      website: "https://globalsolutions.com",
      phone: "+1-555-0456",
      address: {
        street: "456 Business Ave",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "USA",
      },
      annualRevenue: 2000000,
      employeeCount: 100,
      notes: "Strategic consulting firm",
      customFields: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create sample contacts
    const contact1 = await ctx.db.insert("contacts", {
      teamId,
      createdBy: userId,
      sharedWith: [userId],
      firstName: "John",
      lastName: "Smith",
      email: "john.smith@acme.com",
      phone: "+1-555-0124",
      title: "CEO",
      company: "Acme Corporation",
      accountId: account1,
      leadStatus: "qualified",
      contactType: "contact",
      source: "Website",
      notes: "Decision maker for enterprise deals",
      customFields: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const contact2 = await ctx.db.insert("contacts", {
      teamId,
      createdBy: userId,
      sharedWith: [userId],
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah.johnson@globalsolutions.com",
      phone: "+1-555-0457",
      title: "CTO",
      company: "Global Solutions Inc",
      accountId: account2,
      leadStatus: "contacted",
      contactType: "lead",
      source: "LinkedIn",
      notes: "Interested in our enterprise solution",
      customFields: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create sample deals
    const deal1 = await ctx.db.insert("deals", {
      teamId,
      createdBy: userId,
      sharedWith: [userId],
      name: "Acme Enterprise License",
      contactId: contact1,
      accountId: account1,
      stage: "negotiation",
      amount: 50000,
      currency: "USD",
      closeDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
      probability: 75,
      description: "Enterprise software license for 500 users",
      customFields: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const deal2 = await ctx.db.insert("deals", {
      teamId,
      createdBy: userId,
      sharedWith: [userId],
      name: "Global Solutions Consulting",
      contactId: contact2,
      accountId: account2,
      stage: "proposal",
      amount: 25000,
      currency: "USD",
      closeDate: Date.now() + 60 * 24 * 60 * 60 * 1000, // 60 days from now
      probability: 50,
      description: "Custom consulting engagement",
      customFields: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create sample activities
    await ctx.db.insert("activities", {
      teamId,
      createdBy: userId,
      sharedWith: [userId],
      type: "meeting",
      subject: "Product Demo with John Smith",
      description: "Demonstrated our enterprise features to the Acme team",
      contactId: contact1,
      accountId: account1,
      dealId: deal1,
      status: "completed",
      startTime: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      endTime: Date.now() - 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000, // 1 hour later
      attendees: [userId, "john.smith@acme.com"],
      customFields: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("activities", {
      teamId,
      createdBy: userId,
      sharedWith: [userId],
      type: "call",
      subject: "Follow-up with Sarah Johnson",
      description: "Discussed proposal details and next steps",
      contactId: contact2,
      accountId: account2,
      dealId: deal2,
      status: "scheduled",
      startTime: Date.now() + 24 * 60 * 60 * 1000, // Tomorrow
      endTime: Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000, // 30 minutes later
      attendees: [userId, "sarah.johnson@globalsolutions.com"],
      customFields: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      message: "Sample data created successfully!",
      accounts: [account1, account2],
      contacts: [contact1, contact2],
      deals: [deal1, deal2],
    };
  },
}); 