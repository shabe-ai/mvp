import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedTeamData = mutation({
  args: {
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    const teamId = args.teamId;
    const createdBy = "system"; // You can change this to a real user ID if needed

    // Sample accounts
    const accounts = [
      {
        name: "Acme Corporation",
        industry: "Technology",
        website: "https://acme.com",
        phone: "+1-555-0123",
        address: {
          street: "123 Innovation Drive",
          city: "San Francisco",
          state: "CA",
          zip: "94105",
          country: "USA"
        },
        annualRevenue: 50000000,
        employeeCount: 250,
        notes: "Leading software company with innovative products"
      },
      {
        name: "Global Solutions Inc",
        industry: "Consulting",
        website: "https://globalsolutions.com",
        phone: "+1-555-0456",
        address: {
          street: "456 Business Blvd",
          city: "New York",
          state: "NY",
          zip: "10001",
          country: "USA"
        },
        annualRevenue: 25000000,
        employeeCount: 120,
        notes: "Strategic consulting firm specializing in digital transformation"
      },
      {
        name: "TechStart Ventures",
        industry: "Startup",
        website: "https://techstart.com",
        phone: "+1-555-0789",
        address: {
          street: "789 Startup Street",
          city: "Austin",
          state: "TX",
          zip: "73301",
          country: "USA"
        },
        annualRevenue: 5000000,
        employeeCount: 25,
        notes: "Fast-growing startup in the fintech space"
      }
    ];

    // Create accounts
    const accountIds = [];
    for (const account of accounts) {
      const accountId = await ctx.db.insert("accounts", {
        teamId,
        createdBy,
        sharedWith: [createdBy],
        name: account.name,
        industry: account.industry,
        website: account.website,
        phone: account.phone,
        address: account.address,
        annualRevenue: account.annualRevenue,
        employeeCount: account.employeeCount,
        notes: account.notes,
        customFields: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      accountIds.push(accountId);
    }

    // Sample contacts
    const contacts = [
      {
        firstName: "John",
        lastName: "Smith",
        email: "john.smith@acme.com",
        phone: "+1-555-0001",
        title: "CEO",
        company: "Acme Corporation",
        leadStatus: "qualified" as const,
        contactType: "contact" as const,
        source: "Website",
        notes: "Decision maker for enterprise deals"
      },
      {
        firstName: "Sarah",
        lastName: "Johnson",
        email: "sarah.johnson@globalsolutions.com",
        phone: "+1-555-0002",
        title: "VP of Sales",
        company: "Global Solutions Inc",
        leadStatus: "contacted" as const,
        contactType: "contact" as const,
        source: "LinkedIn",
        notes: "Interested in our consulting services"
      },
      {
        firstName: "Mike",
        lastName: "Chen",
        email: "mike.chen@techstart.com",
        phone: "+1-555-0003",
        title: "CTO",
        company: "TechStart Ventures",
        leadStatus: "new" as const,
        contactType: "lead" as const,
        source: "Cold Outreach",
        notes: "Looking for technical partnership opportunities"
      },
      {
        firstName: "Emily",
        lastName: "Davis",
        email: "emily.davis@acme.com",
        phone: "+1-555-0004",
        title: "Marketing Director",
        company: "Acme Corporation",
        leadStatus: "qualified" as const,
        contactType: "contact" as const,
        source: "Referral",
        notes: "Responsible for marketing budget decisions"
      },
      {
        firstName: "David",
        lastName: "Wilson",
        email: "david.wilson@globalsolutions.com",
        phone: "+1-555-0005",
        title: "Operations Manager",
        company: "Global Solutions Inc",
        leadStatus: "contacted" as const,
        contactType: "contact" as const,
        source: "Trade Show",
        notes: "Interested in process optimization solutions"
      }
    ];

    // Create contacts and link to accounts
    const contactIds = [];
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const accountId = accountIds[Math.floor(i / 2)]; // Distribute contacts across accounts
      
      const contactId = await ctx.db.insert("contacts", {
        teamId,
        createdBy,
        sharedWith: [createdBy],
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        title: contact.title,
        company: contact.company,
        accountId,
        leadStatus: contact.leadStatus,
        contactType: contact.contactType,
        source: contact.source,
        notes: contact.notes,
        customFields: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      contactIds.push(contactId);
    }

    // Sample activities
    const activities = [
      {
        type: "email" as const,
        subject: "Initial Contact - Product Demo",
        description: "Sent introductory email about our product features",
        status: "completed" as const,
        startTime: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
        contactId: contactIds[0],
        accountId: accountIds[0]
      },
      {
        type: "call" as const,
        subject: "Follow-up Call",
        description: "Scheduled follow-up call to discuss requirements",
        status: "scheduled" as const,
        startTime: Date.now() + 2 * 24 * 60 * 60 * 1000, // 2 days from now
        contactId: contactIds[1],
        accountId: accountIds[1]
      },
      {
        type: "meeting" as const,
        subject: "Product Demo",
        description: "Demo our solution to the technical team",
        status: "scheduled" as const,
        startTime: Date.now() + 5 * 24 * 60 * 60 * 1000, // 5 days from now
        contactId: contactIds[2],
        accountId: accountIds[2]
      },
      {
        type: "email" as const,
        subject: "Proposal Sent",
        description: "Sent detailed proposal for consulting services",
        status: "completed" as const,
        startTime: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
        contactId: contactIds[3],
        accountId: accountIds[0]
      },
      {
        type: "call" as const,
        subject: "Contract Discussion",
        description: "Discuss contract terms and pricing",
        status: "scheduled" as const,
        startTime: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days from now
        contactId: contactIds[4],
        accountId: accountIds[1]
      }
    ];

    // Create activities
    for (const activity of activities) {
      await ctx.db.insert("activities", {
        teamId,
        createdBy,
        sharedWith: [createdBy],
        type: activity.type,
        subject: activity.subject,
        description: activity.description,
        status: activity.status,
        startTime: activity.startTime,
        contactId: activity.contactId,
        accountId: activity.accountId,
        customFields: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Sample deals
    const deals = [
      {
        name: "Acme Enterprise License",
        amount: 50000,
        stage: "proposal" as const,
        probability: 75,
        closeDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
        contactId: contactIds[0],
        accountId: accountIds[0],
        description: "Enterprise software license for 500 users"
      },
      {
        name: "Global Solutions Consulting",
        amount: 25000,
        stage: "negotiation" as const,
        probability: 60,
        closeDate: Date.now() + 45 * 24 * 60 * 60 * 1000, // 45 days from now
        contactId: contactIds[1],
        accountId: accountIds[1],
        description: "Digital transformation consulting project"
      },
      {
        name: "TechStart Partnership",
        amount: 15000,
        stage: "qualification" as const,
        probability: 40,
        closeDate: Date.now() + 60 * 24 * 60 * 60 * 1000, // 60 days from now
        contactId: contactIds[2],
        accountId: accountIds[2],
        description: "Technical partnership and integration services"
      }
    ];

    // Create deals
    for (const deal of deals) {
      await ctx.db.insert("deals", {
        teamId,
        createdBy,
        sharedWith: [createdBy],
        name: deal.name,
        amount: deal.amount,
        stage: deal.stage,
        probability: deal.probability,
        closeDate: deal.closeDate,
        contactId: deal.contactId,
        accountId: deal.accountId,
        description: deal.description,
        customFields: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return {
      success: true,
      message: `Seeded team with ${accounts.length} accounts, ${contacts.length} contacts, ${activities.length} activities, and ${deals.length} deals`
    };
  },
}); 