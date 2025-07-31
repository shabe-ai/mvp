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
      console.log(`🔍 AI Context: Searching for team: ${teamId}`);
      
      // Get all document chunks for the team
      const chunks = await convex.query(api.documents.getTeamChunks, {
        teamId,
      });

      console.log(`📄 AI Context: Found ${chunks.length} chunks for team: ${teamId}`);

      if (chunks.length === 0) {
        console.log(`❌ AI Context: No chunks found for team: ${teamId}`);
        return [];
      }

      // Check if this is a comprehensive query that needs all documents
      const queryLower = query.toLowerCase();
      const isComprehensiveQuery = 
        queryLower.includes('all') ||
        queryLower.includes('sum') ||
        queryLower.includes('total') ||
        queryLower.includes('every') ||
        queryLower.includes('each') ||
        queryLower.includes('complete') ||
        queryLower.includes('full') ||
        queryLower.includes('entire') ||
        queryLower.includes('everything') ||
        queryLower.includes('processed') ||
        queryLower.includes('files') ||
        queryLower.includes('documents') ||
        queryLower.includes('invoices') ||
        queryLower.includes('expenses');

      // Check if this is a specific file query
      const isSpecificFileQuery = 
        queryLower.includes('.xlsx') ||
        queryLower.includes('.csv') ||
        queryLower.includes('.pdf') ||
        queryLower.includes('.docx') ||
        queryLower.includes('money') ||
        queryLower.includes('transactions') ||
        queryLower.includes('sales') ||
        queryLower.includes('invoice');

      if (isComprehensiveQuery) {
        console.log(`🔍 AI Context: Comprehensive query detected, returning all documents`);
        
        // For comprehensive queries, return all documents without similarity filtering
        const uniqueFiles = new Map<string, { fileName: string; fileType: string; chunks: string[] }>();
        
        chunks.forEach((chunk) => {
          const fileName = chunk.metadata.fileName;
          if (!uniqueFiles.has(fileName)) {
            uniqueFiles.set(fileName, {
              fileName,
              fileType: chunk.metadata.fileType,
              chunks: []
            });
          }
          uniqueFiles.get(fileName)!.chunks.push(chunk.text);
        });

        // Convert to DocumentContext format
        const results: DocumentContext[] = [];
        let chunkIndex = 0;
        
        for (const [fileName, fileData] of uniqueFiles) {
          // Take the first chunk of each file for comprehensive queries
          results.push({
            fileName,
            fileType: fileData.fileType,
            chunkText: fileData.chunks[0] || '',
            similarity: 1.0, // High similarity for comprehensive queries
            chunkIndex: chunkIndex++
          });
        }

        return results.slice(0, maxResults);
      }

      // For specific file queries, find the exact file
      if (isSpecificFileQuery) {
        console.log(`🔍 AI Context: Specific file query detected, searching for exact file`);
        
        // Extract potential filename from query
        const fileExtensions = ['.xlsx', '.csv', '.pdf', '.docx'];
        let targetFileName = '';
        
        for (const ext of fileExtensions) {
          if (queryLower.includes(ext)) {
            // Find the word before the extension
            const words = queryLower.split(/\s+/);
            for (let i = 0; i < words.length; i++) {
              if (words[i].includes(ext)) {
                targetFileName = words[i];
                break;
              }
            }
            break;
          }
        }
        
        // If no extension found, look for common file keywords
        if (!targetFileName) {
          if (queryLower.includes('money')) targetFileName = 'money.xlsx';
          else if (queryLower.includes('transactions')) targetFileName = 'transactions';
          else if (queryLower.includes('sales')) targetFileName = 'sales';
          else if (queryLower.includes('invoice')) targetFileName = 'invoice';
        }
        
        console.log(`🔍 AI Context: Looking for file containing: ${targetFileName}`);
        
        // Find chunks that match the target filename
        const matchingChunks = chunks.filter(chunk => 
          chunk.metadata.fileName.toLowerCase().includes(targetFileName.toLowerCase())
        );
        
        if (matchingChunks.length > 0) {
          console.log(`✅ AI Context: Found ${matchingChunks.length} chunks for ${targetFileName}`);
          
          // For large files, limit to first few chunks to avoid token limits
          const maxChunksForLargeFile = 5;
          const limitedChunks = matchingChunks.slice(0, maxChunksForLargeFile);
          
          console.log(`📊 AI Context: Limiting to ${limitedChunks.length} chunks to avoid token limits`);
          
          // Return limited chunks for the specific file
          return limitedChunks.map((chunk, index) => ({
            fileName: chunk.metadata.fileName,
            fileType: chunk.metadata.fileType,
            chunkText: chunk.text,
            similarity: 1.0, // High similarity for exact file matches
            chunkIndex: index,
          }));
        }
      }

      // For specific queries, use similarity-based filtering
      console.log(`🔍 AI Context: Specific query detected, using similarity filtering`);
      
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
        const similarity = embeddingsService.cosineSimilarity(queryEmbedding, chunk.embedding);
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
      
      // Group documents by filename to avoid repetition
      const groupedDocs = new Map<string, { fileName: string; fileType: string; chunks: string[]; avgSimilarity: number }>();
      
      relevantDocs.forEach((doc) => {
        if (!groupedDocs.has(doc.fileName)) {
          groupedDocs.set(doc.fileName, {
            fileName: doc.fileName,
            fileType: doc.fileType,
            chunks: [],
            avgSimilarity: 0
          });
        }
        
        const group = groupedDocs.get(doc.fileName)!;
        group.chunks.push(doc.chunkText);
        group.avgSimilarity += doc.similarity;
      });
      
      // Calculate average similarity and format context with token limit management
      let docIndex = 1;
      let totalTokens = 0;
      const maxTokensPerContext = 2000; // More aggressive limit to avoid token issues
      let shouldBreak = false;
      
      for (const [fileName, group] of groupedDocs) {
        if (shouldBreak) break;
        
        const avgSimilarity = group.avgSimilarity / group.chunks.length;
        const combinedContent = group.chunks.join(' ');
        
        // Estimate tokens (roughly 4 characters per token)
        const estimatedTokens = combinedContent.length / 4;
        
        // If adding this document would exceed the limit, truncate or skip
        if (totalTokens + estimatedTokens > maxTokensPerContext) {
          // Truncate the content to fit within limits
          const remainingTokens = maxTokensPerContext - totalTokens;
          const maxChars = remainingTokens * 4;
          
          // For large files, show just a sample
          let truncatedContent;
          if (combinedContent.length > maxChars) {
            // Show first 500 chars and last 200 chars with ellipsis
            const firstPart = combinedContent.substring(0, 500);
            const lastPart = combinedContent.substring(combinedContent.length - 200);
            truncatedContent = `${firstPart}... [content truncated] ...${lastPart}`;
          } else {
            truncatedContent = combinedContent;
          }
          
          context += `${docIndex}. **${group.fileName}** (${group.fileType}, avg similarity: ${avgSimilarity.toFixed(3)})\n`;
          context += `Content: ${truncatedContent}\n\n`;
          totalTokens += estimatedTokens;
          docIndex++;
          
          // Add a note about truncation
          if (combinedContent.length > maxChars) {
            context += `[Note: Large file content was truncated. Full analysis available for smaller files.]\n\n`;
            shouldBreak = true;
          }
        } else {
          context += `${docIndex}. **${group.fileName}** (${group.fileType}, avg similarity: ${avgSimilarity.toFixed(3)})\n`;
          context += `Content: ${combinedContent}\n\n`;
          totalTokens += estimatedTokens;
          docIndex++;
        }
      }

      context += 'Please use this information to provide a comprehensive answer. If the documents don\'t contain relevant information, you can still provide a helpful response based on your general knowledge.';

      return {
        hasRelevantDocuments: true,
        context,
        documents: relevantDocs,
        totalDocuments: groupedDocs.size, // Return number of unique documents
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