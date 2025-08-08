import { NextResponse } from 'next/server';
import { TokenStorage } from '@/lib/tokenStorage';

export async function GET() {
  try {
    console.log('🧪 Testing callback logic manually...');
    
    // Test parameters
    const testUserId = 'user_30yNzzaqY36tW07nKprV52twdEQ';
    const testAccessToken = 'test_access_token_123';
    const testRefreshToken = 'test_refresh_token_123';
    const testEmail = 'test@example.com';
    
    // Test token storage directly
    console.log('🔐 Testing token storage...');
    await TokenStorage.setToken(
      testUserId,
      testAccessToken,
      testRefreshToken,
      3600,
      testEmail
    );
    
    // Test token retrieval
    const hasToken = await TokenStorage.hasValidToken(testUserId);
    const token = await TokenStorage.getToken(testUserId);
    const tokenInfo = await TokenStorage.getTokenInfo(testUserId);
    
    console.log('🔍 Token test results:', {
      hasToken,
      tokenExists: !!token,
      tokenInfo: tokenInfo ? {
        hasAccessToken: !!tokenInfo.accessToken,
        hasRefreshToken: !!tokenInfo.refreshToken,
        email: tokenInfo.email,
        createdAt: tokenInfo.createdAt,
        expiresAt: tokenInfo.expiresAt
      } : null
    });
    
    // Clean up
    await TokenStorage.removeToken(testUserId);
    
    return NextResponse.json({
      testUserId,
      tokenStorageTest: {
        setTokenCalled: true,
        hasToken,
        tokenExists: !!token,
        tokenInfo: tokenInfo ? {
          hasAccessToken: !!tokenInfo.accessToken,
          hasRefreshToken: !!tokenInfo.refreshToken,
          email: tokenInfo.email,
          createdAt: tokenInfo.createdAt,
          expiresAt: tokenInfo.expiresAt
        } : null
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error testing callback:', error);
    return NextResponse.json(
      { error: 'Failed to test callback', details: error },
      { status: 500 }
    );
  }
} 