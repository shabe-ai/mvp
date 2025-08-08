import { NextResponse } from 'next/server';
import { TokenStorage } from '@/lib/tokenStorage';

export async function GET() {
  try {
    const testUserId = 'test_user_123';
    const testAccessToken = 'test_access_token_123';
    const testRefreshToken = 'test_refresh_token_123';
    
    console.log('🧪 Testing token storage...');
    
    // Test setting a token
    await TokenStorage.setToken(
      testUserId,
      testAccessToken,
      testRefreshToken,
      3600,
      'test@example.com'
    );
    
    console.log('✅ Token set successfully');
    
    // Test retrieving the token
    const hasToken = await TokenStorage.hasValidToken(testUserId);
    const token = await TokenStorage.getToken(testUserId);
    const tokenInfo = await TokenStorage.getTokenInfo(testUserId);
    
    console.log('🔍 Token retrieval results:', {
      hasToken,
      tokenExists: !!token,
      tokenInfo: tokenInfo ? {
        hasAccessToken: !!tokenInfo.accessToken,
        hasRefreshToken: !!tokenInfo.refreshToken,
        email: tokenInfo.email
      } : null
    });
    
    // Clean up test token
    await TokenStorage.removeToken(testUserId);
    
    return NextResponse.json({
      testUserId,
      tokenSet: true,
      hasToken,
      tokenExists: !!token,
      tokenInfo: tokenInfo ? {
        hasAccessToken: !!tokenInfo.accessToken,
        hasRefreshToken: !!tokenInfo.refreshToken,
        email: tokenInfo.email,
        createdAt: tokenInfo.createdAt,
        expiresAt: tokenInfo.expiresAt
      } : null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error testing token storage:', error);
    return NextResponse.json(
      { error: 'Failed to test token storage', details: error },
      { status: 500 }
    );
  }
} 