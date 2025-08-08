import { NextResponse } from 'next/server';
import { TokenStorage } from '@/lib/tokenStorage';

export async function GET() {
  try {
    const testUserId = 'user_30yNzzaqY36tW07nKprV52twdEQ';
    const testAccessToken = 'test_access_token_123';
    const testRefreshToken = 'test_refresh_token_123';
    
    console.log('🧪 Testing token storage in current environment...');
    
    // Test setting a token
    await TokenStorage.setToken(
      testUserId,
      testAccessToken,
      testRefreshToken,
      3600,
      'test@example.com'
    );
    
    console.log('✅ Test token set successfully');
    
    // Test retrieving the token
    const hasToken = await TokenStorage.hasValidToken(testUserId);
    const token = await TokenStorage.getToken(testUserId);
    const tokenInfo = await TokenStorage.getTokenInfo(testUserId);
    const allTokens = await TokenStorage.getAllTokens();
    
    console.log('🔍 Token retrieval results:', {
      hasToken,
      tokenExists: !!token,
      tokenInfo: tokenInfo ? {
        hasAccessToken: !!tokenInfo.accessToken,
        hasRefreshToken: !!tokenInfo.refreshToken,
        email: tokenInfo.email
      } : null,
      totalTokens: Object.keys(allTokens).length
    });
    
    // Clean up test token
    await TokenStorage.removeToken(testUserId);
    
    return NextResponse.json({
      environment: process.env.NODE_ENV,
      isServerless: process.env.VERCEL === '1' || process.env.NODE_ENV === 'production',
      kvAvailable: !!(process.env.KV_URL && process.env.KV_REST_API_TOKEN),
      testResults: {
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
        totalTokens: Object.keys(allTokens).length
      },
      currentTokens: allTokens,
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