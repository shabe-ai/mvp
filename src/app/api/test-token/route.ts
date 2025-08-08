import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { TokenStorage } from '@/lib/tokenStorage';

export async function GET() {
  try {
    const { userId } = await auth();
    
    // Use hardcoded userId as fallback if Clerk session is not available
    const targetUserId = userId || 'user_30yNzzaqY36tW07nKprV52twdEQ';
    
    console.log('🔍 Testing token for user:', targetUserId);
    console.log('🔍 Clerk userId:', userId);
    
    const hasToken = await TokenStorage.hasValidToken(targetUserId);
    const token = await TokenStorage.getToken(targetUserId);
    const tokenInfo = await TokenStorage.getTokenInfo(targetUserId);
    
    console.log('🔍 Token test results:', {
      hasToken,
      tokenExists: !!token,
      tokenInfo: tokenInfo ? {
        hasAccessToken: !!tokenInfo.accessToken,
        hasRefreshToken: !!tokenInfo.refreshToken,
        email: tokenInfo.email
      } : null
    });
    
    return NextResponse.json({
      hasToken,
      token: token ? '***' : null,
      userEmail: tokenInfo?.email,
      userId: targetUserId,
      authenticated: !!userId,
      clerkUserId: userId
    });
    
  } catch (error) {
    console.error('❌ Error testing token:', error);
    return NextResponse.json(
      { error: 'Failed to test token', details: error },
      { status: 500 }
    );
  }
} 