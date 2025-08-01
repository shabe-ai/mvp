import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

// File-based token storage for persistence
const TOKEN_FILE = path.join(process.cwd(), '.tokens.json');

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
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

// Load tokens from file
function loadTokens(): TokenStorageData {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading tokens:', error);
  }
  return {};
}

// Save tokens to file
function saveTokens(tokens: TokenStorageData): void {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

// Refresh access token using refresh token
async function refreshAccessToken(userId: string, refreshToken: string): Promise<string | null> {
  try {
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (credentials.access_token) {
      // Update stored tokens with new access token
      const tokens = loadTokens();
      const tokenData = tokens[userId];
      
      if (tokenData) {
        tokenData.accessToken = credentials.access_token;
        tokenData.expiresAt = Date.now() + (((credentials as any).expires_in || 3600) * 1000);
        saveTokens(tokens);
        
        console.log('🔄 Access token refreshed for user:', userId);
        return credentials.access_token;
      }
    }
  } catch (error) {
    console.error('❌ Error refreshing access token for user:', userId, error);
  }
  
  return null;
}

export class TokenStorage {
  static setToken(userId: string, accessToken: string, refreshToken?: string, expiresIn: number = 3600): void {
    const tokens = loadTokens();
    const expiresAt = Date.now() + (expiresIn * 1000);
    
    tokens[userId] = { 
      accessToken, 
      refreshToken, 
      expiresAt 
    };
    saveTokens(tokens);
    
    console.log('🔐 Token stored for user:', userId);
    console.log('🔐 Has refresh token:', !!refreshToken);
    console.log('🔐 Total tokens in storage:', Object.keys(tokens).length);
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
} 