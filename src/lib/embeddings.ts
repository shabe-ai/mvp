import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DocumentChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    fileName: string;
    fileType: string;
    folderPath: string;
    chunkIndex: number;
    totalChunks: number;
    lastModified: Date;
  };
}

export interface ProcessedDocument {
  id: string;
  fileName: string;
  fileType: string;
  folderPath: string;
  content: string;
  chunks: DocumentChunk[];
  lastModified: Date;
  embeddingCount: number;
}

export class EmbeddingsService {
  /**
   * Split text into chunks for embedding
   */
  private splitTextIntoChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      let chunk = text.slice(start, end);
      
      // Try to break at sentence boundaries
      if (end < text.length) {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > start + chunkSize * 0.7) {
          chunk = chunk.slice(0, breakPoint + 1);
        }
      }
      
      chunks.push(chunk.trim());
      start = end - overlap;
      
      if (start >= text.length) break;
    }
    
    return chunks.filter(chunk => chunk.length > 50); // Filter out very short chunks
  }

  /**
   * Generate embeddings for text chunks
   */
  async generateEmbeddings(textChunks: string[]): Promise<number[][]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: textChunks,
        encoding_format: 'float',
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('❌ Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Process a document and create embeddings
   */
  async processDocument(
    fileId: string,
    fileName: string,
    fileType: string,
    folderPath: string,
    content: string,
    lastModified: Date
  ): Promise<ProcessedDocument> {
    try {
      console.log(`🧠 Processing document: ${fileName} (${content.length} characters)`);
      
      // Split text into chunks
      const textChunks = this.splitTextIntoChunks(content);
      console.log(`📄 Split into ${textChunks.length} chunks`);
      
      // Generate embeddings for all chunks
      const embeddings = await this.generateEmbeddings(textChunks);
      console.log(`🔢 Generated ${embeddings.length} embeddings`);
      
      // Create document chunks with embeddings
      const chunks: DocumentChunk[] = textChunks.map((chunk, index) => ({
        id: `${fileId}_chunk_${index}`,
        text: chunk,
        embedding: embeddings[index],
        metadata: {
          fileName,
          fileType,
          folderPath,
          chunkIndex: index,
          totalChunks: textChunks.length,
          lastModified,
        },
      }));
      
      return {
        id: fileId,
        fileName,
        fileType,
        folderPath,
        content,
        chunks,
        lastModified,
        embeddingCount: chunks.length,
      };
    } catch (error) {
      console.error('❌ Error processing document:', error);
      throw error;
    }
  }

  /**
   * Find similar documents using semantic search
   */
  async findSimilarDocuments(
    query: string,
    documents: ProcessedDocument[],
    topK: number = 5
  ): Promise<{ document: ProcessedDocument; chunk: DocumentChunk; similarity: number }[]> {
    try {
      // Generate embedding for the query
      const queryEmbeddings = await this.generateEmbeddings([query]);
      const queryEmbedding = queryEmbeddings[0];
      
      // Calculate similarities with all document chunks
      const similarities: { document: ProcessedDocument; chunk: DocumentChunk; similarity: number }[] = [];
      
      for (const document of documents) {
        for (const chunk of document.chunks) {
          const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
          similarities.push({
            document,
            chunk,
            similarity,
          });
        }
      }
      
      // Sort by similarity and return top K results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      console.error('❌ Error finding similar documents:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }

  /**
   * Create context from relevant documents for AI chat
   */
  async createDocumentContext(
    query: string,
    documents: ProcessedDocument[]
  ): Promise<string> {
    try {
      const similarDocs = await this.findSimilarDocuments(query, documents, 3);
      
      if (similarDocs.length === 0) {
        return '';
      }
      
      let context = 'Relevant documents:\n\n';
      
      similarDocs.forEach((result, index) => {
        const { document, chunk, similarity } = result;
        context += `${index + 1}. ${document.fileName} (similarity: ${similarity.toFixed(3)})\n`;
        context += `Content: ${chunk.text}\n\n`;
      });
      
      return context;
    } catch (error) {
      console.error('❌ Error creating document context:', error);
      return '';
    }
  }
}

// Export singleton instance
export const embeddingsService = new EmbeddingsService(); 