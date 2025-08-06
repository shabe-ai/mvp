import { NextResponse } from "next/server";
import { auth, currentUser } from '@clerk/nextjs/server';

interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface AdminAuthResult {
  isAdmin: boolean;
  adminUser: AdminUser | null;
  adminLoading: boolean;
}

// Server-side admin check
async function checkAdminStatus(): Promise<AdminAuthResult> {
  try {
    const session = await auth();
    const user = await currentUser();
    const userId = session?.userId;

    if (!userId || !user) {
      return {
        isAdmin: false,
        adminUser: null,
        adminLoading: false
      };
    }

    // Check if user is admin based on email domain or specific user IDs
    const userEmail = user.emailAddresses?.[0]?.emailAddress;
    
    if (!userEmail) {
      return {
        isAdmin: false,
        adminUser: null,
        adminLoading: false
      };
    }

    // Define admin emails or domains
    const adminEmails = [
      'admin@shabe.ai',
      'vigeash@shabe.ai',
      'vigeashgobal@gmail.com'
    ];

    const adminDomains = [
      'shabe.ai'
    ];

    const emailDomain = userEmail.split('@')[1];
    const isAdminEmail = adminEmails.includes(userEmail);
    const isAdminDomain = adminDomains.includes(emailDomain);

    if (isAdminEmail || isAdminDomain) {
      return {
        isAdmin: true,
        adminUser: {
          id: userId,
          email: userEmail,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined
        },
        adminLoading: false
      };
    }

    return {
      isAdmin: false,
      adminUser: null,
      adminLoading: false
    };

  } catch (error) {
    console.error('Error checking admin status:', error);
    return {
      isAdmin: false,
      adminUser: null,
      adminLoading: false
    };
  }
}

export async function GET() {
  try {
    const result = await checkAdminStatus();
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error in admin check API:', error);
    return NextResponse.json(
      { error: 'Failed to check admin status' },
      { status: 500 }
    );
  }
} 