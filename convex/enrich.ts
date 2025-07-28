import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

const APOLLO_API_KEY = "4aO-qM5GwS8m70Ds-ks4kQ";

export const enrichContact: ReturnType<typeof action> = action({
  args: {
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    // Get the contact
    const contact = await ctx.runQuery(api.crm.getContactById, { contactId: args.contactId });
    console.log("Enriching contact:", contact);
    if (!contact) return { message: "Contact not found." };
    if (!contact.email && !contact.firstName && !contact.lastName) return { message: "No data to enrich." };

    // Call Apollo.io enrichment API
    const response = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        person_emails: contact.email ? [contact.email] : [],
        q_person_first_name: contact.firstName || undefined,
        q_person_last_name: contact.lastName || undefined,
        page: 1,
        per_page: 1,
      }),
    });
    if (!response.ok) {
      console.log("Apollo enrichment failed:", response.statusText);
      return { message: `Apollo enrichment failed: ${response.statusText}` };
    }
    const data = await response.json();
    console.log("Apollo API response:", data);
    const enriched = data.people && data.people.length > 0 ? data.people[0] : null;
    if (!enriched) {
      console.log("No enrichment data found.");
      return { message: "No enrichment data found." };
    }
    // Map Apollo fields to your contact schema as needed
    const updates: Record<string, unknown> = {
      title: enriched.title,
      company: enriched.organization?.name,
      linkedin: enriched.linkedin_url,
      // Add more fields as needed
    };
    console.log("Updating contact with:", updates);
    await ctx.runMutation(api.crm.updateContact, { contactId: args.contactId, updates });
    return { message: "Contact enriched!", updates };
  },
});

export const enrichAccount: ReturnType<typeof action> = action({
  args: {
    accountId: v.id("accounts"),
  },
  handler: async (ctx, args) => {
    // Get the account
    const account = await ctx.runQuery(api.crm.getAccountById, { accountId: args.accountId });
    console.log("Enriching account:", account);
    if (!account) return { message: "Account not found." };
    if (!account.name) return { message: "No data to enrich." };

    // Call Apollo.io enrichment API for companies (using domain or name)
    const response = await fetch("https://api.apollo.io/v1/organizations/enrich", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        name: account.name,
        website_url: account.website || undefined,
      }),
    });
    if (!response.ok) {
      console.log("Apollo enrichment failed:", response.statusText);
      return { message: `Apollo enrichment failed: ${response.statusText}` };
    }
    const data = await response.json();
    console.log("Apollo API response:", data);
    if (!data.organization) {
      console.log("No enrichment data found.");
      return { message: "No enrichment data found." };
    }
    // Map Apollo fields to your account schema as needed
    const updates: Record<string, unknown> = {
      industry: data.organization.industry,
      website: data.organization.website_url,
      linkedin: data.organization.linkedin_url,
      // Add more fields as needed
    };
    console.log("Updating account with:", updates);
    await ctx.runMutation(api.crm.updateAccount, { accountId: args.accountId, updates });
    return { message: "Account enriched!", updates };
  },
}); 