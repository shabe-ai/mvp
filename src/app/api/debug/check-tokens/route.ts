import { NextResponse } from "next/server";
import { auth, currentUser } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const session = await auth();
    const user = await currentUser();
    const userId = session?.userId;

    if (!userId || !user) {
      return NextResponse.json({ 
        error: 'No user found',
        userId: userId || 'missing',
        hasUser: !!user
      });
    }

    // Try to get Google tokens from Clerk
    const tokenResponse = await fetch(`https://api.clerk.com/v1/users/${userId}/oauth_access_tokens/oauth_google`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const tokenData = await tokenResponse.json();
    
    return NextResponse.json({
      userId,
      userEmail: user.emailAddresses?.[0]?.emailAddress,
      tokenResponseStatus: tokenResponse.status,
      tokenResponseOk: tokenResponse.ok,
      tokenData,
      hasTokens: !!tokenData.data?.[0]?.token,
      tokenCount: tokenData.data?.length || 0,
      firstToken: tokenData.data?.[0] ? {
        hasToken: !!tokenData.data[0].token,
        hasRefreshToken: !!tokenData.data[0].refresh_token,
        tokenLength: tokenData.data[0].token?.length || 0,
        refreshTokenLength: tokenData.data[0].refresh_token?.length || 0,
        scopes: tokenData.data[0].scopes || []
      } : null
    });
  } catch (error) {
    console.error('Error checking tokens:', error);
    return NextResponse.json({ 
      error: 'Failed to check tokens',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
