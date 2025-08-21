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

    const userEmail = user.emailAddresses?.[0]?.emailAddress;
    
    return NextResponse.json({
      userId,
      email: userEmail,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      emailDomain: userEmail ? userEmail.split('@')[1] : null,
      isAdminEmail: userEmail === 'admin@shabe.ai' || userEmail === 'vigeash@shabe.ai' || userEmail === 'vigeashgobal@gmail.com',
      isAdminDomain: userEmail ? ['shabe.ai'].includes(userEmail.split('@')[1]) : false
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    return NextResponse.json({ 
      error: 'Failed to get user info',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
