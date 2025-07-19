// Simple in-memory token storage
// In production, you should use a proper database
const tokenStorage = new Map<string, { accessToken: string; expiresAt: number }>();

export class TokenStorage {
  static setToken(userId: string, accessToken: string, expiresIn: number = 3600): void {
    const expiresAt = Date.now() + (expiresIn * 1000);
    tokenStorage.set(userId, { accessToken, expiresAt });
    console.log('🔐 Token stored for user:', userId);
  }

  static getToken(userId: string): string | null {
    const tokenData = tokenStorage.get(userId);
    
    if (!tokenData) {
      return null;
    }

    // Check if token is expired
    if (Date.now() > tokenData.expiresAt) {
      tokenStorage.delete(userId);
      console.log('⏰ Token expired for user:', userId);
      return null;
    }

    return tokenData.accessToken;
  }

  static removeToken(userId: string): void {
    tokenStorage.delete(userId);
    console.log('🗑️ Token removed for user:', userId);
  }

  static hasValidToken(userId: string): boolean {
    return this.getToken(userId) !== null;
  }
} 