import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { embeddingsService } from './embeddings';

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface DocumentContext {
  fileName: string;
  fileType: string;
  chunkText: string;
  similarity: number;
  chunkIndex: number;
}

export interface AIContextResult {
  hasRelevantDocuments: boolean;
  context: string;
  documents: DocumentContext[];
  totalDocuments: number;
}

export class AIContextService {
  /**
   * Find relevant documents for a user query
   */
  async findRelevantDocuments(
    query: string,
    teamId: string,
    maxResults: number = 3
  ): Promise<DocumentContext[]> {
    try {
      // Get all document chunks for the team
      const chunks = await convex.query(api.documents.getTeamChunks, {
        teamId,
      });

      if (chunks.length === 0) {
        return [];
      }

      // Generate embedding for the query
      const queryEmbeddings = await embeddingsService.generateEmbeddings([query]);
      const queryEmbedding = queryEmbeddings[0];

      // Calculate similarities with all chunks
      const similarities: Array<{
        chunk: {
          metadata: {
            fileName: string;
            fileType: string;
          };
          text: string;
          chunkIndex: number;
          embedding: number[];
        };
        similarity: number;
      }> = [];

      for (const chunk of chunks) {
        const similarity = embeddingsService['cosineSimilarity'](queryEmbedding, chunk.embedding);
        similarities.push({
          chunk,
          similarity,
        });
      }

      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxResults)
        .map(({ chunk, similarity }) => ({
          fileName: chunk.metadata.fileName,
          fileType: chunk.metadata.fileType,
          chunkText: chunk.text,
          similarity,
          chunkIndex: chunk.chunkIndex,
        }));
    } catch (error) {
      console.error('❌ Error finding relevant documents:', error);
      return [];
    }
  }

  /**
   * Create context string for AI chat
   */
  async createAIContext(
    query: string,
    teamId: string,
    maxResults: number = 3
  ): Promise<AIContextResult> {
    try {
      const relevantDocs = await this.findRelevantDocuments(query, teamId, maxResults);

      if (relevantDocs.length === 0) {
        return {
          hasRelevantDocuments: false,
          context: '',
          documents: [],
          totalDocuments: 0,
        };
      }

      // Create context string
      let context = 'Based on your question, here are relevant documents from your knowledge base:\n\n';
      
      relevantDocs.forEach((doc, index) => {
        context += `${index + 1}. **${doc.fileName}** (similarity: ${doc.similarity.toFixed(3)})\n`;
        context += `Content: ${doc.chunkText}\n\n`;
      });

      context += 'Please use this information to provide a comprehensive answer. If the documents don\'t contain relevant information, you can still provide a helpful response based on your general knowledge.';

      return {
        hasRelevantDocuments: true,
        context,
        documents: relevantDocs,
        totalDocuments: relevantDocs.length,
      };
    } catch (error) {
      console.error('❌ Error creating AI context:', error);
      return {
        hasRelevantDocuments: false,
        context: '',
        documents: [],
        totalDocuments: 0,
      };
    }
  }

  /**
   * Get document statistics for a team
   */
  async getTeamDocumentStats(teamId: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalEmbeddings: number;
  }> {
    try {
      const documents = await convex.query(api.documents.getTeamDocuments, {
        teamId,
      });

      const chunks = await convex.query(api.documents.getTeamChunks, {
        teamId,
      });

      return {
        totalDocuments: documents.length,
        totalChunks: chunks.length,
        totalEmbeddings: chunks.length,
      };
    } catch (error) {
      console.error('❌ Error getting document stats:', error);
      return {
        totalDocuments: 0,
        totalChunks: 0,
        totalEmbeddings: 0,
      };
    }
  }

  /**
   * Search documents with a query
   */
  async searchDocuments(
    query: string,
    teamId: string,
    maxResults: number = 5
  ): Promise<DocumentContext[]> {
    return await this.findRelevantDocuments(query, teamId, maxResults);
  }
}

// Export singleton instance
export const aiContextService = new AIContextService(); 