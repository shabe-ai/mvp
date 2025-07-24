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

    // Create 20 sample accounts
    const accountIds = [];
    for (let i = 1; i <= 20; i++) {
      const accountId = await ctx.db.insert("accounts", {
        teamId,
        createdBy: userId,
        sharedWith: [userId],
        name: `Sample Account ${i}`,
        industry: i % 2 === 0 ? "Technology" : "Consulting",
        website: `https://sample${i}.com`,
        phone: `+1-555-01${i.toString().padStart(2, "0")}`,
        address: { street: `${i} Main St`, city: "City", state: "ST", zip: "00000", country: "USA" },
        annualRevenue: 1000000 + i * 10000,
        employeeCount: 10 + i,
        notes: `Sample account #${i}`,
        customFields: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      accountIds.push(accountId);
    }

    // Create 20 sample contacts
    const contactIds = [];
    for (let i = 1; i <= 20; i++) {
      const contactId = await ctx.db.insert("contacts", {
        teamId,
        createdBy: userId,
        sharedWith: [userId],
        firstName: `First${i}`,
        lastName: `Last${i}`,
        email: `user${i}@sample.com`,
        phone: `+1-555-02${i.toString().padStart(2, "0")}`,
        title: i % 2 === 0 ? "Manager" : "Engineer",
        company: `Sample Account ${((i - 1) % 20) + 1}`,
        accountId: accountIds[(i - 1) % 20],
        leadStatus: ["new", "contacted", "qualified", "unqualified"][i % 4] as "new" | "contacted" | "qualified" | "unqualified",
        contactType: i % 2 === 0 ? "lead" : "contact",
        source: i % 2 === 0 ? "Website" : "LinkedIn",
        notes: `Sample contact #${i}`,
        customFields: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      contactIds.push(contactId);
    }

    // Create 20 sample deals
    const dealIds = [];
    for (let i = 1; i <= 20; i++) {
      const dealId = await ctx.db.insert("deals", {
        teamId,
        createdBy: userId,
        sharedWith: [userId],
        name: `Sample Deal ${i}`,
        contactId: contactIds[(i - 1) % 20],
        accountId: accountIds[(i - 1) % 20],
        stage: ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"][i % 6] as "prospecting" | "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost",
        amount: 10000 + i * 1000,
        currency: "USD",
        closeDate: Date.now() + i * 24 * 60 * 60 * 1000,
        probability: Math.floor(Math.random() * 100),
        description: `Sample deal #${i}`,
        customFields: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      dealIds.push(dealId);
    }

    // Create 20 sample activities
    for (let i = 1; i <= 20; i++) {
      await ctx.db.insert("activities", {
        teamId,
        createdBy: userId,
        sharedWith: [userId],
        type: ["meeting", "call", "email", "event"][i % 4] as "meeting" | "call" | "email" | "event",
        subject: `Sample Activity ${i}`,
        description: `Description for activity #${i}`,
        contactId: contactIds[(i - 1) % 20],
        accountId: accountIds[(i - 1) % 20],
        dealId: dealIds[(i - 1) % 20],
        status: ["scheduled", "completed", "cancelled"][i % 3] as "scheduled" | "completed" | "cancelled",
        startTime: Date.now() + i * 60 * 60 * 1000,
        endTime: Date.now() + i * 60 * 60 * 1000 + 30 * 60 * 1000,
        attendees: [userId, `user${i}@sample.com`],
        customFields: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return {
      message: "Sample data created successfully!",
      accounts: accountIds,
      contacts: contactIds,
      deals: dealIds,
    };
  },
}); 