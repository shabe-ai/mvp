# Admin Role System

## Overview

We've implemented a secure admin role system using Clerk's user metadata to control access to administrative features and analytics dashboards.

## 🔐 **Security Features**

### **Role-Based Access Control**
- **Admin users**: Full access to analytics, monitoring, and admin features
- **Regular users**: Access to chat, file upload, and their own data only
- **Unauthenticated users**: Sign-in/sign-up only

### **Admin Privileges**
- ✅ Analytics Dashboard access
- ✅ Monitoring Dashboard access  
- ✅ Admin panel navigation
- ✅ System-wide metrics viewing
- ✅ Cost and usage tracking

### **User Privileges**
- ✅ Chat functionality
- ✅ File upload and analysis
- ✅ Personal data management
- ✅ Team creation and management
- ❌ No access to analytics or admin features

## 🛠️ **Implementation Details**

### **Files Created/Modified**

#### Core Admin System
- `src/lib/adminAuth.ts` - Admin authentication utilities
- `src/app/admin/page.tsx` - Updated with role-based access control
- `src/app/layout.tsx` - Updated to show Admin link only for admins

#### Setup Scripts
- `scripts/setup-admin.js` - Script to configure admin users in Clerk

### **Admin Authentication Flow**

```typescript
// Check if user has admin role
const { isAdmin, user, loading } = useAdminAuth();

if (!isAdmin) {
  return <AccessDenied />;
}
```

### **Role Checking Methods**

#### Client-Side (React)
```typescript
import { useAdminAuth } from '@/lib/adminAuth';

function MyComponent() {
  const { isAdmin, user, loading } = useAdminAuth();
  
  if (loading) return <Loading />;
  if (!isAdmin) return <AccessDenied />;
  
  return <AdminDashboard />;
}
```

#### Server-Side (API Routes)
```typescript
import { checkAdminRole } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  
  if (!checkAdminRole(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // Admin-only logic here
}
```

## 📧 **Admin Email Configuration**

### **Current Admin Emails**
```javascript
const ADMIN_EMAILS = [
  'vigeashgobal@gmail.com', // Your email
  'admin@shabe.ai',
];
```

### **Adding New Admins**

#### Method 1: Using the Setup Script
```bash
# 1. Get your Clerk API key from https://dashboard.clerk.com/
# 2. Add the email to ADMIN_EMAILS in scripts/setup-admin.js
# 3. Run the script
CLERK_API_KEY=your_key node scripts/setup-admin.js
```

#### Method 2: Manual Clerk Dashboard
1. Go to https://dashboard.clerk.com/
2. Navigate to Users
3. Find the user you want to make admin
4. Edit their metadata
5. Add: `{ "role": "admin" }`

#### Method 3: Programmatic (for future automation)
```typescript
import { getUserRole } from '@/lib/adminAuth';

// Check if email should be admin
const role = getUserRole(user);
if (role === 'admin') {
  // Grant admin access
}
```

## 🔒 **Security Measures**

### **Access Control Layers**
1. **UI Level**: Admin links only visible to admins
2. **Route Level**: Admin pages check role before rendering
3. **API Level**: Server-side role verification
4. **Database Level**: User isolation (users only see their own data)

### **Fallback Protection**
- **Email-based admin list**: Hardcoded admin emails as backup
- **Clerk metadata**: Primary role storage
- **Graceful degradation**: System works even if role checks fail

### **Privacy Protection**
- **User data isolation**: Users can only access their own data
- **Admin-only analytics**: Aggregated metrics only visible to admins
- **No PII exposure**: Personal data masked in logs and analytics

## 🚀 **Usage Examples**

### **Protecting Admin Routes**
```typescript
// In any admin page
export default function AdminPage() {
  const { isAdmin, loading } = useAdminAuth();
  
  if (loading) return <Loading />;
  if (!isAdmin) return <AccessDenied />;
  
  return <AdminContent />;
}
```

### **Conditional UI Elements**
```typescript
// In layout or components
const { isAdmin } = useAdminAuth();

return (
  <nav>
    <Link href="/">Home</Link>
    {isAdmin && <Link href="/admin">Admin</Link>}
  </nav>
);
```

### **API Route Protection**
```typescript
// In API routes
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  const user = await clerkClient.users.getUser(userId);
  
  if (!checkAdminRole(user)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  
  // Admin-only API logic
}
```

## 🔧 **Setup Instructions**

### **1. Configure Admin Users**
```bash
# Get your Clerk API key from https://dashboard.clerk.com/
export CLERK_API_KEY=your_api_key

# Run the setup script
node scripts/setup-admin.js
```

### **2. Verify Admin Access**
1. Sign in with an admin email
2. Navigate to `/admin`
3. Verify you can see the analytics dashboards
4. Check that the Admin link appears in the header

### **3. Test Regular User Access**
1. Sign in with a non-admin email
2. Verify you cannot access `/admin`
3. Confirm the Admin link is not visible
4. Test that chat and other features work normally

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Admin link not showing**
   - Check if user email is in `ADMIN_EMAILS` list
   - Verify Clerk metadata is set correctly
   - Clear browser cache and reload

2. **Access denied on admin page**
   - Run the setup script to configure admin role
   - Check browser console for errors
   - Verify user is signed in

3. **Setup script fails**
   - Verify `CLERK_API_KEY` is correct
   - Check API key permissions in Clerk dashboard
   - Ensure user exists in Clerk

### **Debug Commands**
```bash
# Check current user roles
node scripts/setup-admin.js

# Test admin authentication
curl -H "Authorization: Bearer $CLERK_API_KEY" \
  https://api.clerk.com/v1/users
```

## 🔮 **Future Enhancements**

### **Planned Features**
1. **Role management UI**: Admin interface to manage user roles
2. **Permission granularity**: Fine-grained permissions (read-only, full admin, etc.)
3. **Audit logging**: Track admin actions and role changes
4. **Multi-tenant support**: Organization-based admin roles

### **Integration Opportunities**
1. **Clerk webhooks**: Automatic role updates
2. **SSO integration**: Enterprise admin provisioning
3. **Role inheritance**: Team-based admin roles
4. **Temporary admin access**: Time-limited admin privileges

## 📋 **Admin Responsibilities**

### **What Admins Can Do**
- View system-wide analytics and metrics
- Monitor cost and usage patterns
- Access error logs and performance data
- Manage integrations and settings
- View aggregated user activity

### **What Admins Cannot Do**
- Access individual user data (privacy protection)
- Modify user accounts (handled by Clerk)
- Delete user data (data retention policies)
- Override rate limits (system protection)

## ✅ **Security Checklist**

- [x] Role-based access control implemented
- [x] Admin routes protected
- [x] UI elements conditionally rendered
- [x] Server-side role verification
- [x] User data isolation maintained
- [x] Admin setup script created
- [x] Documentation provided
- [x] Error handling implemented
- [x] Privacy protection in place

The admin role system is now **production-ready** and provides secure, granular access control for administrative features while maintaining user privacy and data isolation. 