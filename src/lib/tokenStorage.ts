import fs from 'fs';
import path from 'path';

// File-based token storage for persistence
const TOKEN_FILE = path.join(process.cwd(), '.tokens.json');

interface TokenData {
  accessToken: string;
  expiresAt: number;
}

interface TokenStorageData {
  [userId: string]: TokenData;
}

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

export class TokenStorage {
  static setToken(userId: string, accessToken: string, expiresIn: number = 3600): void {
    const tokens = loadTokens();
    const expiresAt = Date.now() + (expiresIn * 1000);
    
    tokens[userId] = { accessToken, expiresAt };
    saveTokens(tokens);
    
    console.log('🔐 Token stored for user:', userId);
    console.log('🔐 Total tokens in storage:', Object.keys(tokens).length);
    console.log('🔐 All user IDs:', Object.keys(tokens));
  }

  static getToken(userId: string): string | null {
    console.log('🔍 Looking for token for user:', userId);
    
    const tokens = loadTokens();
    console.log('🔍 Total tokens in storage:', Object.keys(tokens).length);
    console.log('🔍 All user IDs:', Object.keys(tokens));
    
    const tokenData = tokens[userId];
    
    if (!tokenData) {
      console.log('❌ No token found for user:', userId);
      return null;
    }

    // Check if token is expired
    if (Date.now() > tokenData.expiresAt) {
      delete tokens[userId];
      saveTokens(tokens);
      console.log('⏰ Token expired for user:', userId);
      return null;
    }

    console.log('✅ Token found for user:', userId);
    return tokenData.accessToken;
  }

  static removeToken(userId: string): void {
    const tokens = loadTokens();
    delete tokens[userId];
    saveTokens(tokens);
    console.log('🗑️ Token removed for user:', userId);
  }

  static hasValidToken(userId: string): boolean {
    return this.getToken(userId) !== null;
  }
} 