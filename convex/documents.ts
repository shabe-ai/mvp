import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Store a processed document
export const storeDocument = mutation({
  args: {
    teamId: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileId: v.string(),
    folderPath: v.string(),
    content: v.string(),
    contentLength: v.number(),
    chunkCount: v.number(),
    embeddingCount: v.number(),
    lastModified: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    // Check if document already exists
    const existingDoc = await ctx.db
      .query("documents")
      .withIndex("by_file_id", (q) => q.eq("fileId", args.fileId))
      .first();

    if (existingDoc) {
      // Update existing document
      return await ctx.db.patch(existingDoc._id, {
        fileName: args.fileName,
        fileType: args.fileType,
        folderPath: args.folderPath,
        content: args.content,
        contentLength: args.contentLength,
        chunkCount: args.chunkCount,
        embeddingCount: args.embeddingCount,
        lastModified: args.lastModified,
        updatedAt: Date.now(),
        processingStatus: "completed",
      });
    } else {
      // Create new document
      return await ctx.db.insert("documents", {
        teamId: args.teamId,
        createdBy: userId,
        sharedWith: [userId],
        fileName: args.fileName,
        fileType: args.fileType,
        fileId: args.fileId,
        folderPath: args.folderPath,
        content: args.content,
        contentLength: args.contentLength,
        chunkCount: args.chunkCount,
        embeddingCount: args.embeddingCount,
        processingStatus: "completed",
        lastModified: args.lastModified,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Store document chunks with embeddings
export const storeDocumentChunks = mutation({
  args: {
    teamId: v.string(),
    documentId: v.id("documents"),
    chunks: v.array(
      v.object({
        chunkIndex: v.number(),
        text: v.string(),
        embedding: v.array(v.number()),
        metadata: v.object({
          fileName: v.string(),
          fileType: v.string(),
          folderPath: v.string(),
          totalChunks: v.number(),
          lastModified: v.number(),
        }),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    // Delete existing chunks for this document
    const existingChunks = await ctx.db
      .query("documentChunks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const chunk of existingChunks) {
      await ctx.db.delete(chunk._id);
    }

    // Insert new chunks
    const chunkIds = [];
    for (const chunk of args.chunks) {
      const chunkId = await ctx.db.insert("documentChunks", {
        teamId: args.teamId,
        documentId: args.documentId,
        createdBy: userId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        embedding: chunk.embedding,
        metadata: chunk.metadata,
        createdAt: Date.now(),
      });
      chunkIds.push(chunkId);
    }

    return chunkIds;
  },
});

// Get documents for a team
export const getTeamDocuments = query({
  args: {
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("documents")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .collect();
  },
});

// Get document by file ID
export const getDocumentByFileId = query({
  args: {
    fileId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("documents")
      .withIndex("by_file_id", (q) => q.eq("fileId", args.fileId))
      .first();
  },
});

// Get document chunks for semantic search
export const getDocumentChunks = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("documentChunks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("asc")
      .collect();
  },
});

// Get all chunks for a team (for semantic search)
export const getTeamChunks = query({
  args: {
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("documentChunks")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
  },
});

// Delete document and its chunks
export const deleteDocument = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Delete chunks first
    const chunks = await ctx.db
      .query("documentChunks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    // Delete document
    await ctx.db.delete(args.documentId);
  },
});

// Update document processing status
export const updateDocumentStatus = mutation({
  args: {
    documentId: v.id("documents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.patch(args.documentId, {
      processingStatus: args.status,
      updatedAt: Date.now(),
    });
  },
}); 