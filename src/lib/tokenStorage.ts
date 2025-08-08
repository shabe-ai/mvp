import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

// File-based token storage for persistence
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

// Initialize Google OAuth2 client for token refresh
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
);

// Check if file system is writable
function isFileSystemWritable(): boolean {
  try {
    // Try to write a test file
    const testFile = path.join(process.cwd(), '.test-write');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch (error) {
    console.log('⚠️ File system is read-only, using environment variable fallback');
    return false;
  }
}

// Load tokens from file with backup recovery
function loadTokens(): TokenStorageData {
  try {
    // Try primary file first
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf8');
      const tokens = JSON.parse(data);
      console.log('📁 Loaded tokens from primary file');
      return tokens;
    }
    
    // Try backup file if primary doesn't exist
    if (fs.existsSync(TOKEN_BACKUP_FILE)) {
      const data = fs.readFileSync(TOKEN_BACKUP_FILE, 'utf8');
      const tokens = JSON.parse(data);
      console.log('📁 Loaded tokens from backup file');
      // Restore primary file
      saveTokens(tokens);
      return tokens;
    }
  } catch (error) {
    console.error('❌ Error loading tokens from file:', error);
    
    // Try backup file if primary file is corrupted
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
  
  // If file system fails, try environment variable
  return loadTokensFromEnv();
}

// Save tokens to file with backup
function saveTokens(tokens: TokenStorageData): void {
  try {
    // Check if file system is writable
    if (!isFileSystemWritable()) {
      console.log('⚠️ File system is read-only, storing in environment variable');
      // Store in environment variable as fallback
      process.env.GOOGLE_TOKENS = JSON.stringify(tokens);
      return;
    }
    
    // Create backup first
    if (fs.existsSync(TOKEN_FILE)) {
      fs.copyFileSync(TOKEN_FILE, TOKEN_BACKUP_FILE);
    }
    
    // Save to primary file
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    console.log('💾 Tokens saved successfully');
  } catch (error) {
    console.error('❌ Error saving tokens:', error);
    // Try environment variable as fallback
    try {
      process.env.GOOGLE_TOKENS = JSON.stringify(tokens);
      console.log('💾 Tokens saved to environment variable as fallback');
    } catch (envError) {
      console.error('❌ Error saving to environment variable:', envError);
    }
  }
}

// Load tokens from environment variable if file system fails
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
      const tokens = loadTokens();
      const tokenData = tokens[userId];
      
      if (tokenData) {
        tokenData.accessToken = newAccessToken;
        tokenData.expiresAt = Date.now() + (((credentials as { credentials: { expires_in?: number } }).credentials.expires_in || 3600) * 1000);
        tokenData.lastRefreshed = Date.now();
        saveTokens(tokens);
        
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
  static setToken(userId: string, accessToken: string, refreshToken?: string, expiresIn: number = 3600, email?: string): void {
    console.log('🚨 SETTOKEN CALLED - userId:', userId, 'hasAccessToken:', !!accessToken, 'hasRefreshToken:', !!refreshToken);
    
    const tokens = loadTokens();
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
    saveTokens(tokens);
    
    console.log('🔐 Token stored for user:', userId);
    console.log('🔐 Has refresh token:', !!refreshToken);
    console.log('🔐 Total tokens in storage:', Object.keys(tokens).length);
    console.log('🔐 User email:', email);
  }

  static async getToken(userId: string): Promise<string | null> {
    console.log('🔍 Looking for token for user:', userId);
    
    const tokens = loadTokens();
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
          saveTokens(tokens);
          console.log('❌ Token refresh failed, removed token for user:', userId);
          return null;
        }
      } else {
        // No refresh token, remove the expired token
        delete tokens[userId];
        saveTokens(tokens);
        console.log('❌ No refresh token available, removed expired token for user:', userId);
        return null;
      }
    }

    console.log('✅ Valid token found for user:', userId);
    return tokenData.accessToken;
  }

  static removeToken(userId: string): void {
    const tokens = loadTokens();
    delete tokens[userId];
    saveTokens(tokens);
    console.log('🗑️ Token removed for user:', userId);
  }

  static async hasValidToken(userId: string): Promise<boolean> {
    const token = await this.getToken(userId);
    return token !== null;
  }

  static getRefreshToken(userId: string): string | null {
    const tokens = loadTokens();
    const tokenData = tokens[userId];
    return tokenData?.refreshToken || null;
  }

  // Get all stored tokens (for debugging)
  static getAllTokens(): TokenStorageData {
    return loadTokens();
  }

  // Get token info for a specific user
  static getTokenInfo(userId: string): TokenData | null {
    const tokens = loadTokens();
    return tokens[userId] || null;
  }

  // Check if connection is persistent (has refresh token)
  static isPersistentConnection(userId: string): boolean {
    const tokens = loadTokens();
    const tokenData = tokens[userId];
    return !!(tokenData && tokenData.refreshToken);
  }
} 