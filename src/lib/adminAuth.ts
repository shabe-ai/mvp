import { useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

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

// Client-side admin hook
export function useAdminAuth(): AdminAuthResult {
  const { user, isLoaded } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    const checkAdmin = async () => {
      try {
        const response = await fetch('/api/admin/check');
        const data = await response.json();
        
        setIsAdmin(data.isAdmin);
        setAdminUser(data.adminUser);
        setAdminLoading(false);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        setAdminUser(null);
        setAdminLoading(false);
      }
    };

    if (user) {
      checkAdmin();
    } else {
      setIsAdmin(false);
      setAdminUser(null);
      setAdminLoading(false);
    }
  }, [user, isLoaded]);

  return { isAdmin, adminUser, adminLoading };
} 