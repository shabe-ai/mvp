import { useUser } from "@clerk/nextjs";

export interface AdminUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'user';
}

// Check if user has admin role
export function useAdminAuth(): { 
  isAdmin: boolean; 
  isAnalyticsAdmin: boolean; 
  user: AdminUser | null; 
  loading: boolean; 
} {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return { isAdmin: false, user: null, loading: true };
  }

  if (!user) {
    return { isAdmin: false, user: null, loading: false };
  }

  // Check for admin role in public metadata
  const userRole = user.publicMetadata?.role as string;
  const isAdminFromRole = userRole === 'admin';
  
  // Check if user ID is in admin list (temporary override)
  const isAdminFromId = ADMIN_USER_IDS.includes(user.id);
  
  // Check if email is in admin list
  const userEmail = user.emailAddresses[0]?.emailAddress;
  const isAdminFromEmail = userEmail && isAdminEmail(userEmail);
  
  const isAdmin = isAdminFromRole || isAdminFromId || isAdminFromEmail;
  
  // Check if user has analytics admin privileges
  const isAnalyticsAdmin = ANALYTICS_ADMIN_USER_IDS.includes(user.id);



  const adminUser: AdminUser = {
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress,
    firstName: user.firstName || undefined,
    lastName: user.lastName || undefined,
    role: isAdmin ? 'admin' : 'user',
  };

  return { isAdmin, isAnalyticsAdmin, user: adminUser, loading: false };
}

// Server-side admin check
export function checkAdminRole(user: any): boolean {
  if (!user) return false;
  
  const userRole = user.publicMetadata?.role as string;
  return userRole === 'admin';
}

// List of admin emails (for development/testing)
const ADMIN_EMAILS = [
  'vigeashgobal@gmail.com', // Your email
  'vigeash11@gmail.com', // Additional admin
  'admin@shabe.ai',
  // Add more admin emails as needed
];

// Analytics admin user IDs (only these users can see analytics dashboards)
const ANALYTICS_ADMIN_USER_IDS = [
  'user_3042sPD7bBdcCjuw4gX6lAGFbkS', // Your current user ID
  // Add more analytics admin user IDs as needed
];

// Admin user IDs (for development/testing)
const ADMIN_USER_IDS = [
  'user_3042sPD7bBdcCjuw4gX6lAGFbkS', // Your current user ID
  // Add more admin user IDs as needed
];

// Check if email is in admin list
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// Get admin role for user
export function getUserRole(user: any): 'admin' | 'user' {
  if (!user) return 'user';
  
  const userRole = user.publicMetadata?.role as string;
  if (userRole === 'admin') return 'admin';
  
  // Check if user email is in admin list
  const userEmail = user.emailAddresses[0]?.emailAddress;
  if (userEmail && isAdminEmail(userEmail)) {
    return 'admin';
  }
  
  return 'user';
} 