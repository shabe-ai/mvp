import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { Redis } from '@upstash/redis';

// File-based token storage for local development
const TOKEN_FILE = path.join(process.cwd(), '.tokens.json');
const TOKEN_BACKUP_FILE = path.join(process.cwd(), '.tokens.backup.json');

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  createdAt: number;
  lastRefreshed: number;
  userId: string;
  email?: string;
}

interface TokenStorageData {
  [userId: string]: TokenData;
}

// In-memory token storage as fallback
let memoryTokens: TokenStorageData = {};

// Initialize Google OAuth2 client for token refresh
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
);



// Check if Redis is available
function isRedisAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// Initialize Redis client
function getRedisClient(): Redis | null {
  if (!isRedisAvailable()) {
    return null;
  }
  
  try {
    return Redis.fromEnv();
  } catch (error) {
    console.error('❌ Error initializing Redis client:', error);
    return null;
  }
}

// Check if file system is writable
function isFileSystemWritable(): boolean {
  try {
    const testFile = path.join(process.cwd(), '.test-write');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    console.log('⚠️ File system is read-only, using Redis storage');
    return false;
  }
}

// Load tokens with priority: Redis > Environment Variable > File System > Memory
async function loadTokens(): Promise<TokenStorageData> {
  // Try Redis first (for production)
  const redis = getRedisClient();
  if (redis) {
    try {
      const kvTokens = await redis.get('google_tokens');
      if (kvTokens) {
        console.log('📁 Loaded tokens from Redis storage');
        return kvTokens as TokenStorageData;
      }
    } catch (error) {
      console.error('❌ Error loading tokens from Redis:', error);
    }
  }

  // Try environment variable as fallback
  const envTokens = loadTokensFromEnv();
  if (Object.keys(envTokens).length > 0) {
    console.log('📁 Loaded tokens from environment variable');
    return envTokens;
  }

  // Try file system (for local development)
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf8');
      const tokens = JSON.parse(data);
      console.log('📁 Loaded tokens from primary file');
      return tokens;
    }
    
    if (fs.existsSync(TOKEN_BACKUP_FILE)) {
      const data = fs.readFileSync(TOKEN_BACKUP_FILE, 'utf8');
      const tokens = JSON.parse(data);
      console.log('📁 Loaded tokens from backup file');
      saveTokens(tokens);
      return tokens;
    }
  } catch (error) {
    console.error('❌ Error loading tokens from file:', error);
    
    try {
      if (fs.existsSync(TOKEN_BACKUP_FILE)) {
        const data = fs.readFileSync(TOKEN_BACKUP_FILE, 'utf8');
        const tokens = JSON.parse(data);
        console.log('📁 Restored tokens from backup after corruption');
        saveTokens(tokens);
        return tokens;
      }
    } catch (backupError) {
      console.error('❌ Error loading backup tokens:', backupError);
    }
  }
  
  // Finally, try memory storage
  console.log('📁 Using memory storage (no persistent tokens found)');
  return memoryTokens;
}

// Save tokens with priority: Redis > File System > Memory
async function saveTokens(tokens: TokenStorageData): Promise<void> {
  console.log('💾 Attempting to save tokens...');
  
  // Try Redis first (for production)
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set('google_tokens', tokens);
      console.log('💾 Tokens saved successfully to Redis storage');
      return;
    } catch (error) {
      console.error('❌ Error saving tokens to Redis:', error);
    }
  }

  // Try file system (for local development)
  try {
    if (!isFileSystemWritable()) {
      console.log('⚠️ File system is read-only, storing in memory');
      memoryTokens = tokens;
      console.log('💾 Tokens saved to memory storage');
      return;
    }
    
    if (fs.existsSync(TOKEN_FILE)) {
      fs.copyFileSync(TOKEN_FILE, TOKEN_BACKUP_FILE);
    }
    
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    console.log('💾 Tokens saved successfully to file');
  } catch (error) {
    console.error('❌ Error saving tokens to file:', error);
    try {
      memoryTokens = tokens;
      console.log('💾 Tokens saved to memory storage as fallback');
    } catch (memError) {
      console.error('❌ Error saving to memory storage:', memError);
    }
  }
}

// Load tokens from environment variable
function loadTokensFromEnv(): TokenStorageData {
  try {
    const envTokens = process.env.GOOGLE_TOKENS;
    if (envTokens) {
      const tokens = JSON.parse(envTokens);
      console.log('📁 Loaded tokens from environment variable');
      return tokens;
    }
  } catch (error) {
    console.error('❌ Error loading tokens from environment:', error);
  }
  return {};
}

// Refresh access token using refresh token
async function refreshAccessToken(userId: string, refreshToken: string): Promise<string | null> {
  try {
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const credentials = await oauth2Client.refreshAccessToken();
    const newAccessToken = (credentials as { credentials: { access_token?: string } }).credentials.access_token;
    
    if (newAccessToken) {
      // Update stored tokens with new access token
      const tokens = await loadTokens();
      const tokenData = tokens[userId];
      
      if (tokenData) {
        tokenData.accessToken = newAccessToken;
        tokenData.expiresAt = Date.now() + (((credentials as { credentials: { expires_in?: number } }).credentials.expires_in || 3600) * 1000);
        tokenData.lastRefreshed = Date.now();
        await saveTokens(tokens);
        
        console.log('🔄 Access token refreshed for user:', userId);
        return newAccessToken;
      }
    }
  } catch (error) {
    console.error('❌ Error refreshing access token for user:', userId, error);
  }
  
  return null;
}

export class TokenStorage {
  static async setToken(userId: string, accessToken: string, refreshToken?: string, expiresIn: number = 3600, email?: string): Promise<void> {
    console.log('🚨 SETTOKEN CALLED - userId:', userId, 'hasAccessToken:', !!accessToken, 'hasRefreshToken:', !!refreshToken);
    
    const tokens = await loadTokens();
    const expiresAt = Date.now() + (expiresIn * 1000);
    const now = Date.now();
    
    tokens[userId] = { 
      accessToken, 
      refreshToken, 
      expiresAt,
      createdAt: now,
      lastRefreshed: now,
      userId,
      email
    };
    await saveTokens(tokens);
    
    console.log('🔐 Token stored for user:', userId);
    console.log('🔐 Has refresh token:', !!refreshToken);
    console.log('🔐 Total tokens in storage:', Object.keys(tokens).length);
    console.log('🔐 User email:', email);
  }

  static async getToken(userId: string): Promise<string | null> {
    console.log('🔍 Looking for token for user:', userId);
    
    const tokens = await loadTokens();
    const tokenData = tokens[userId];
    
    if (!tokenData) {
      console.log('❌ No token found for user:', userId);
      return null;
    }

    // Check if token is expired
    if (Date.now() > tokenData.expiresAt) {
      console.log('⏰ Token expired for user:', userId);
      
      // Try to refresh the token if we have a refresh token
      if (tokenData.refreshToken) {
        console.log('🔄 Attempting to refresh token for user:', userId);
        const newAccessToken = await refreshAccessToken(userId, tokenData.refreshToken);
        
        if (newAccessToken) {
          return newAccessToken;
        } else {
          // Refresh failed, remove the token
          delete tokens[userId];
          await saveTokens(tokens);
          console.log('❌ Token refresh failed, removed token for user:', userId);
          return null;
        }
      } else {
        // No refresh token, remove the expired token
        delete tokens[userId];
        await saveTokens(tokens);
        console.log('❌ No refresh token available, removed expired token for user:', userId);
        return null;
      }
    }

    console.log('✅ Valid token found for user:', userId);
    return tokenData.accessToken;
  }

  static async removeToken(userId: string): Promise<void> {
    const tokens = await loadTokens();
    delete tokens[userId];
    await saveTokens(tokens);
    console.log('🗑️ Token removed for user:', userId);
  }

  static async hasValidToken(userId: string): Promise<boolean> {
    const token = await this.getToken(userId);
    return token !== null;
  }

  static async getRefreshToken(userId: string): Promise<string | null> {
    const tokens = await loadTokens();
    const tokenData = tokens[userId];
    return tokenData?.refreshToken || null;
  }

  // Get all stored tokens (for debugging)
  static async getAllTokens(): Promise<TokenStorageData> {
    return await loadTokens();
  }

  // Get token info for a specific user
  static async getTokenInfo(userId: string): Promise<TokenData | null> {
    const tokens = await loadTokens();
    return tokens[userId] || null;
  }

  // Check if connection is persistent (has refresh token)
  static async isPersistentConnection(userId: string): Promise<boolean> {
    const tokens = await loadTokens();
    const tokenData = tokens[userId];
    return !!(tokenData && tokenData.refreshToken);
  }
} 