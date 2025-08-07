import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const user = await currentUser();
    
    // Get headers for debugging
    const headers = Object.fromEntries(request.headers.entries());
    const cookie = request.headers.get('cookie');
    
    return NextResponse.json({
      authenticated: !!session?.userId,
      userId: session?.userId,
      userEmail: user?.emailAddresses?.[0]?.emailAddress,
      firstName: user?.firstName,
      lastName: user?.lastName,
      sessionExists: !!session,
      userExists: !!user,
      debug: {
        hasCookie: !!cookie,
        cookieLength: cookie?.length || 0,
        userAgent: headers['user-agent']?.substring(0, 50) || 'none',
        origin: headers['origin'] || 'none',
        referer: headers['referer'] || 'none'
      }
    });
  } catch (error) {
    console.error('❌ Error testing auth:', error);
    return NextResponse.json(
      { error: 'Failed to test authentication', details: error },
      { status: 500 }
    );
  }
} 