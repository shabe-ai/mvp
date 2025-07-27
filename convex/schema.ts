import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Custom field types
const customFieldTypes = v.union(
  v.literal("text"),
  v.literal("number"), 
  v.literal("date"),
  v.literal("boolean"),
  v.literal("dropdown")
);

// Custom field value
const customFieldValue = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null()
);

// Teams table
export default defineSchema({
  teams: defineTable({
    name: v.string(),
    ownerId: v.string(),
    members: v.array(v.string()),
    settings: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_member", ["members"]),

  // Contacts table (leads + contacts)
  contacts: defineTable({
    teamId: v.string(),
    createdBy: v.string(),
    sharedWith: v.array(v.string()),
    
    // Standard fields
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    
    // Relationships
    accountId: v.optional(v.id("accounts")), // Required relationship
    
    // Status fields
    leadStatus: v.union(
      v.literal("new"),
      v.literal("contacted"), 
      v.literal("qualified"),
      v.literal("unqualified")
    ),
    contactType: v.union(
      v.literal("lead"),
      v.literal("contact")
    ),
    
    // Additional fields
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    
    // Custom fields
    customFields: v.optional(v.record(v.string(), customFieldValue)),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_account", ["accountId"])
    .index("by_email", ["email"])
    .index("by_created_by", ["createdBy"]),

  // Accounts table (companies/organizations)
  accounts: defineTable({
    teamId: v.string(),
    createdBy: v.string(),
    sharedWith: v.array(v.string()),
    
    // Standard fields
    name: v.string(),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    
    // Address
    address: v.optional(v.object({
      street: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      zip: v.optional(v.string()),
      country: v.optional(v.string()),
    })),
    
    // Business info
    annualRevenue: v.optional(v.number()),
    employeeCount: v.optional(v.number()),
    notes: v.optional(v.string()),
    
    // Custom fields
    customFields: v.optional(v.record(v.string(), customFieldValue)),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_created_by", ["createdBy"]),

  // Activities table (emails, events, calls, meetings)
  activities: defineTable({
    teamId: v.string(),
    createdBy: v.string(),
    sharedWith: v.array(v.string()),
    
    // Activity details
    type: v.union(
      v.literal("email"),
      v.literal("event"),
      v.literal("call"),
      v.literal("meeting")
    ),
    subject: v.string(),
    description: v.optional(v.string()),
    
    // Relationships (can reference one of each)
    contactId: v.optional(v.id("contacts")),
    accountId: v.optional(v.id("accounts")),
    dealId: v.optional(v.id("deals")),
    
    // Status and timing
    status: v.union(
      v.literal("scheduled"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    attendees: v.optional(v.array(v.string())),
    
    // Custom fields
    customFields: v.optional(v.record(v.string(), customFieldValue)),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_contact", ["contactId"])
    .index("by_account", ["accountId"])
    .index("by_deal", ["dealId"])
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .index("by_created_by", ["createdBy"]),

  // Logs table (chat messages)
  logs: defineTable({
    teamId: v.string(),
    createdBy: v.string(),
    sharedWith: v.array(v.string()),
    
    // Message details
    message: v.string(),
    role: v.union(
      v.literal("user"),
      v.literal("assistant")
    ),
    
    // Relationships (can reference one of each)
    relatedContactId: v.optional(v.id("contacts")),
    relatedAccountId: v.optional(v.id("accounts")),
    relatedDealId: v.optional(v.id("deals")),
    
    // Metadata
    metadata: v.optional(v.object({
      action: v.optional(v.string()),
      entityType: v.optional(v.string()),
      entityId: v.optional(v.string()),
    })),
    
    createdAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_created_by", ["createdBy"])
    .index("by_related_contact", ["relatedContactId"])
    .index("by_related_account", ["relatedAccountId"])
    .index("by_related_deal", ["relatedDealId"])
    .index("by_created_at", ["createdAt"]),

  // Deals table (sales opportunities)
  deals: defineTable({
    teamId: v.string(),
    createdBy: v.string(),
    sharedWith: v.array(v.string()),
    
    // Deal details
    name: v.string(),
    
    // Relationships (optional)
    contactId: v.optional(v.id("contacts")),
    accountId: v.optional(v.id("accounts")),
    
    // Sales info
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
    
    // Custom fields
    customFields: v.optional(v.record(v.string(), customFieldValue)),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_contact", ["contactId"])
    .index("by_account", ["accountId"])
    .index("by_stage", ["stage"])
    .index("by_created_by", ["createdBy"]),

  // Custom field definitions (for tracking field types)
  customFieldDefinitions: defineTable({
    teamId: v.string(),
    objectType: v.union(
      v.literal("contacts"),
      v.literal("accounts"),
      v.literal("activities"),
      v.literal("deals")
    ),
    fieldName: v.string(),
    fieldType: customFieldTypes,
    fieldOptions: v.optional(v.array(v.string())), // For dropdown fields
    createdAt: v.number(),
  })
    .index("by_team_and_object", ["teamId", "objectType"])
    .index("by_field_name", ["fieldName"]),

  // Documents table (processed Google Drive documents)
  documents: defineTable({
    teamId: v.string(),
    createdBy: v.string(),
    sharedWith: v.array(v.string()),
    
    // Document metadata
    fileName: v.string(),
    fileType: v.string(),
    fileId: v.string(), // Google Drive file ID
    folderPath: v.string(),
    
    // Processing info (no full content storage)
    contentLength: v.number(),
    chunkCount: v.number(),
    embeddingCount: v.number(),
    processingStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    
    // Timestamps
    lastModified: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_created_by", ["createdBy"])
    .index("by_file_id", ["fileId"])
    .index("by_status", ["processingStatus"])
    .index("by_created_at", ["createdAt"]),

  // Document chunks table (for embeddings and search)
  documentChunks: defineTable({
    teamId: v.string(),
    documentId: v.id("documents"),
    createdBy: v.string(),
    
    // Chunk details
    chunkIndex: v.number(),
    text: v.string(),
    embedding: v.array(v.number()), // Vector embedding
    
    // Metadata
    metadata: v.object({
      fileName: v.string(),
      fileType: v.string(),
      folderPath: v.string(),
      totalChunks: v.number(),
      lastModified: v.number(),
    }),
    
    createdAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_document", ["documentId"])
    .index("by_created_by", ["createdBy"])
    .index("by_chunk_index", ["chunkIndex"]),
}); 