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

    console.log('🔍 Admin check - Session:', { userId: userId ? 'present' : 'missing' });
    console.log('🔍 Admin check - User:', { 
      exists: !!user, 
      email: user?.emailAddresses?.[0]?.emailAddress,
      firstName: user?.firstName,
      lastName: user?.lastName
    });

    if (!userId || !user) {
      console.log('❌ Admin check - No user or session');
      return {
        isAdmin: false,
        adminUser: null,
        adminLoading: false
      };
    }

    // Check if user is admin based on email domain or specific user IDs
    const userEmail = user.emailAddresses?.[0]?.emailAddress;
    
    if (!userEmail) {
      console.log('❌ Admin check - No email found');
      return {
        isAdmin: false,
        adminUser: null,
        adminLoading: false
      };
    }

    console.log('🔍 Admin check - User email:', userEmail);

    // Define admin emails or domains
    const adminEmails = [
      'admin@shabe.ai',
      'vigeash@shabe.ai',
      'vigeashgobal@gmail.com',
      'vigeashgobal@yahoo.com',
      'vigeashgobal@hotmail.com',
      'vigeashgobal@outlook.com'
    ];

    const adminDomains = [
      'shabe.ai'
    ];

    // Temporary admin override for specific user IDs
    const adminUserIds = [
      'user_30yNzzaqY36tW07nKprV52twdEQ' // Vigeash's user ID
    ];

    const emailDomain = userEmail.split('@')[1];
    const isAdminEmail = adminEmails.includes(userEmail);
    const isAdminDomain = adminDomains.includes(emailDomain);
    const isAdminUserId = adminUserIds.includes(userId);

    console.log('🔍 Admin check - Email domain:', emailDomain);
    console.log('🔍 Admin check - Is admin email:', isAdminEmail);
    console.log('🔍 Admin check - Is admin domain:', isAdminDomain);
    console.log('🔍 Admin check - Is admin user ID:', isAdminUserId);

    if (isAdminEmail || isAdminDomain || isAdminUserId) {
      console.log('✅ Admin check - User is admin');
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

    console.log('❌ Admin check - User is not admin');
    return {
      isAdmin: false,
      adminUser: null,
      adminLoading: false
    };
    /*
    if (!userId || !user) {
      console.log('❌ Admin check - No user or session');
      return {
        isAdmin: false,
        adminUser: null,
        adminLoading: false
      };
    }

    // Check if user is admin based on email domain or specific user IDs
    const userEmail = user.emailAddresses?.[0]?.emailAddress;
    
    if (!userEmail) {
      console.log('❌ Admin check - No email found');
      return {
        isAdmin: false,
        adminUser: null,
        adminLoading: false
      };
    }

    console.log('🔍 Admin check - User email:', userEmail);

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

    console.log('🔍 Admin check - Email domain:', emailDomain);
    console.log('🔍 Admin check - Is admin email:', isAdminEmail);
    console.log('🔍 Admin check - Is admin domain:', isAdminDomain);

    if (isAdminEmail || isAdminDomain) {
      console.log('✅ Admin check - User is admin');
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

    console.log('❌ Admin check - User is not admin');
    return {
      isAdmin: false,
      adminUser: null,
      adminLoading: false
    };
    */

  } catch (error) {
    console.error('❌ Error checking admin status:', error);
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