import OpenAI from "openai";
import { convex } from "./convex";
import { api } from "@/convex/_generated/api";
import { logger } from "./logger";

interface ChatCompletionParams {
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: false;
}

interface EmbeddingsParams {
  model: string;
  input: string | string[];
  encoding_format?: "float" | "base64";
}

// Rate limiting configuration
const RATE_LIMITS = {
  // Per user per minute
  USER_PER_MINUTE: 10,
  // Per user per hour
  USER_PER_HOUR: 100,
  // Per user per day
  USER_PER_DAY: 1000,
  // Global per minute (across all users)
  GLOBAL_PER_MINUTE: 50,
  // Global per hour
  GLOBAL_PER_HOUR: 500,
  // Global per day
  GLOBAL_PER_DAY: 5000,
};

// Cost tracking (approximate costs per 1K tokens)
const COST_PER_1K_TOKENS = {
  "gpt-4": 0.03, // $0.03 per 1K input tokens
  "gpt-4-turbo": 0.01, // $0.01 per 1K input tokens
  "gpt-3.5-turbo": 0.001, // $0.001 per 1K input tokens
  "text-embedding-ada-002": 0.0001, // $0.0001 per 1K tokens
  "text-embedding-3-small": 0.00002, // $0.00002 per 1K tokens
};

interface RateLimitConfig {
  userId?: string;
  operation: string;
  model?: string;
}

class RateLimitedOpenAI {
  private client: OpenAI;
  private globalCounts = {
    minute: { count: 0, resetTime: Date.now() + 60000 },
    hour: { count: 0, resetTime: Date.now() + 3600000 },
    day: { count: 0, resetTime: Date.now() + 86400000 },
  };

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private async checkRateLimit(config: RateLimitConfig): Promise<boolean> {
    const { userId, operation } = config;
    
    if (!userId) {
      logger.warn("Rate limiting skipped - no userId provided");
      return true;
    }

    const now = Date.now();

    // Check global limits
    if (now > this.globalCounts.minute.resetTime) {
      this.globalCounts.minute = { count: 0, resetTime: now + 60000 };
    }
    if (now > this.globalCounts.hour.resetTime) {
      this.globalCounts.hour = { count: 0, resetTime: now + 3600000 };
    }
    if (now > this.globalCounts.day.resetTime) {
      this.globalCounts.day = { count: 0, resetTime: now + 86400000 };
    }

    // Check user limits using Convex
    try {
      const rateLimitStatus = await convex.query(api.monitoring.getRateLimitStatus, { userId });
      
      if (rateLimitStatus.userLimits.minute.count >= RATE_LIMITS.USER_PER_MINUTE) {
        logger.warn("Rate limit exceeded: User exceeded per-minute limit", { userId });
        return false;
      }
      if (rateLimitStatus.userLimits.hour.count >= RATE_LIMITS.USER_PER_HOUR) {
        logger.warn("Rate limit exceeded: User exceeded per-hour limit", { userId });
        return false;
      }
      if (rateLimitStatus.userLimits.day.count >= RATE_LIMITS.USER_PER_DAY) {
        logger.warn("Rate limit exceeded: User exceeded per-day limit", { userId });
        return false;
      }
    } catch (error) {
      logger.error("Error checking rate limits", error instanceof Error ? error : new Error(String(error)), { 
        userId 
      });
      // Allow request if rate limit check fails
    }

    // Check global limits
    if (this.globalCounts.minute.count >= RATE_LIMITS.GLOBAL_PER_MINUTE) {
      logger.warn("Rate limit exceeded: Global per-minute limit exceeded");
      return false;
    }
    if (this.globalCounts.hour.count >= RATE_LIMITS.GLOBAL_PER_HOUR) {
      logger.warn("Rate limit exceeded: Global per-hour limit exceeded");
      return false;
    }
    if (this.globalCounts.day.count >= RATE_LIMITS.GLOBAL_PER_DAY) {
      logger.warn("Rate limit exceeded: Global per-day limit exceeded");
      return false;
    }

    // Increment global counters
    this.globalCounts.minute.count++;
    this.globalCounts.hour.count++;
    this.globalCounts.day.count++;

    // Store rate limit data in Convex
    try {
      await convex.mutation(api.monitoring.storeRateLimitData, {
        userId,
        operation,
      });
    } catch (error) {
      logger.error("Error storing rate limit data", error instanceof Error ? error : new Error(String(error)), { 
        userId 
      });
    }

    return true;
  }

  private async trackCost(userId: string, model: string, inputTokens: number, outputTokens: number): Promise<void> {
    const costPer1K = COST_PER_1K_TOKENS[model as keyof typeof COST_PER_1K_TOKENS] || 0.03;
    const inputCost = (inputTokens / 1000) * costPer1K;
    const outputCost = (outputTokens / 1000) * costPer1K;
    const totalCost = inputCost + outputCost;

    try {
      await convex.mutation(api.monitoring.storeCostData, {
        userId,
        model,
        inputTokens,
        outputTokens,
        cost: totalCost,
        operation: 'chat_completion',
      });

      logger.info("Cost tracked", { 
        userId, 
        model, 
        inputTokens, 
        outputTokens, 
        cost: totalCost.toFixed(4) 
      });
    } catch (error) {
      logger.error("Error storing cost data", error instanceof Error ? error : new Error(String(error)), { 
        userId 
      });
    }
  }

  async chatCompletionsCreate(params: ChatCompletionParams, config: RateLimitConfig) {
    if (!(await this.checkRateLimit(config))) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    try {
      const response = await this.client.chat.completions.create(params);
      
      // Track cost
      if (config.userId && response.usage) {
        await this.trackCost(
          config.userId,
          params.model,
          response.usage.prompt_tokens,
          response.usage.completion_tokens
        );
      }

      return response;
    } catch (error) {
      logger.error("OpenAI API error", error instanceof Error ? error : new Error(String(error)), { 
        userId: config.userId 
      });
      throw error;
    }
  }

  async embeddingsCreate(params: EmbeddingsParams, config: RateLimitConfig) {
    if (!(await this.checkRateLimit(config))) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    try {
      const response = await this.client.embeddings.create(params);
      
      // Track cost for embeddings
      if (config.userId && response.usage) {
        await this.trackCost(
          config.userId,
          "text-embedding-3-small",
          response.usage.total_tokens,
          0
        );
      }

      return response;
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw error;
    }
  }

  // Get cost statistics from Convex
  async getCostStats(userId?: string, timeWindow?: number): Promise<{
    totalCost: number;
    totalRequests: number;
    averageCostPerRequest: number;
    costByModel: Record<string, number>;
  }> {
    try {
      const stats = await convex.query(api.monitoring.getCostStats, {
        userId,
        timeWindow,
      });
      return stats;
    } catch (error) {
      console.error("Error getting cost stats:", error);
      return {
        totalCost: 0,
        totalRequests: 0,
        averageCostPerRequest: 0,
        costByModel: {},
      };
    }
  }

  // Get rate limit status from Convex
  async getRateLimitStatus(userId: string): Promise<{
    userLimits: {
      minute: { count: number; limit: number; remaining: number };
      hour: { count: number; limit: number; remaining: number };
      day: { count: number; limit: number; remaining: number };
    };
    globalLimits: {
      minute: { count: number; limit: number; remaining: number };
      hour: { count: number; limit: number; remaining: number };
      day: { count: number; limit: number; remaining: number };
    };
  }> {
    try {
      const userLimits = await convex.query(api.monitoring.getRateLimitStatus, { userId });
      
      return {
        userLimits: {
          minute: { count: userLimits.userLimits.minute.count, limit: RATE_LIMITS.USER_PER_MINUTE, remaining: Math.max(0, RATE_LIMITS.USER_PER_MINUTE - userLimits.userLimits.minute.count) },
          hour: { count: userLimits.userLimits.hour.count, limit: RATE_LIMITS.USER_PER_HOUR, remaining: Math.max(0, RATE_LIMITS.USER_PER_HOUR - userLimits.userLimits.hour.count) },
          day: { count: userLimits.userLimits.day.count, limit: RATE_LIMITS.USER_PER_DAY, remaining: Math.max(0, RATE_LIMITS.USER_PER_DAY - userLimits.userLimits.day.count) },
        },
        globalLimits: {
          minute: { count: this.globalCounts.minute.count, limit: RATE_LIMITS.GLOBAL_PER_MINUTE, remaining: Math.max(0, RATE_LIMITS.GLOBAL_PER_MINUTE - this.globalCounts.minute.count) },
          hour: { count: this.globalCounts.hour.count, limit: RATE_LIMITS.GLOBAL_PER_HOUR, remaining: Math.max(0, RATE_LIMITS.GLOBAL_PER_HOUR - this.globalCounts.hour.count) },
          day: { count: this.globalCounts.day.count, limit: RATE_LIMITS.GLOBAL_PER_DAY, remaining: Math.max(0, RATE_LIMITS.GLOBAL_PER_DAY - this.globalCounts.day.count) },
        },
      };
    } catch (error) {
      console.error("Error getting rate limit status:", error);
      return {
        userLimits: {
          minute: { count: 0, limit: RATE_LIMITS.USER_PER_MINUTE, remaining: RATE_LIMITS.USER_PER_MINUTE },
          hour: { count: 0, limit: RATE_LIMITS.USER_PER_HOUR, remaining: RATE_LIMITS.USER_PER_HOUR },
          day: { count: 0, limit: RATE_LIMITS.USER_PER_DAY, remaining: RATE_LIMITS.USER_PER_DAY },
        },
        globalLimits: {
          minute: { count: this.globalCounts.minute.count, limit: RATE_LIMITS.GLOBAL_PER_MINUTE, remaining: Math.max(0, RATE_LIMITS.GLOBAL_PER_MINUTE - this.globalCounts.minute.count) },
          hour: { count: this.globalCounts.hour.count, limit: RATE_LIMITS.GLOBAL_PER_HOUR, remaining: Math.max(0, RATE_LIMITS.GLOBAL_PER_HOUR - this.globalCounts.hour.count) },
          day: { count: this.globalCounts.day.count, limit: RATE_LIMITS.GLOBAL_PER_DAY, remaining: Math.max(0, RATE_LIMITS.GLOBAL_PER_DAY - this.globalCounts.day.count) },
        },
      };
    }
  }
}

// Export singleton instance
export const openaiClient = new RateLimitedOpenAI(); 