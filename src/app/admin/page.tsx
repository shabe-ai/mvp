"use client";
import { useUser } from "@clerk/nextjs";
import { useState, useEffect, useCallback } from "react";
import MonitoringDashboard from "@/components/MonitoringDashboard";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import ProfileManagement from "@/components/ProfileManagement";
import { useAdminAuth } from "@/lib/adminAuth";
import ConvexProviderWrapper from "@/components/ConvexProvider";

function GoogleIntegrationSection() {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isPersistent, setIsPersistent] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [calendarError, setCalendarError] = useState(false);

  const checkConnection = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/test-token");
      const data = await res.json();
      
      // If the API returns an error due to session issues, use a fallback approach
      if (data.error && data.error.includes('User not authenticated')) {
        // Use hardcoded userId for testing
        const fallbackRes = await fetch("/api/debug/token-check");
        const fallbackData = await fallbackRes.json();
        
        setIsConnected(!!fallbackData.hasToken);
        setIsPersistent(!!fallbackData.persistentConnection);
        setLoading(false);
        
        console.log('🔍 Connection check (fallback):', {
          hasToken: fallbackData.hasToken,
          persistentConnection: fallbackData.persistentConnection,
          userEmail: fallbackData.userEmail,
          tokenCreatedAt: fallbackData.tokenCreatedAt,
          lastRefreshed: fallbackData.lastRefreshed
        });
      } else {
        setIsConnected(!!data.hasToken);
        setIsPersistent(!!data.persistentConnection);
        setLoading(false);
        
        // Log detailed connection info
        console.log('🔍 Connection check:', {
          hasToken: data.hasToken,
          persistentConnection: data.persistentConnection,
          userEmail: data.userEmail,
          tokenCreatedAt: data.tokenCreatedAt,
          lastRefreshed: data.lastRefreshed
        });
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsConnected(false);
      setIsPersistent(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    checkConnection();
    // Test calendar access
    fetch("/api/calendar")
      .then(res => res.json())
      .then(data => {
        if (data.summary && data.summary.toLowerCase().includes("insufficient authentication scopes")) {
          setCalendarError(true);
        } else {
          setCalendarError(false);
        }
      })
      .catch(() => setCalendarError(true));
  }, [user, checkConnection]);

  const handleConnect = async () => {
    setLoading(true);
    const res = await fetch("/api/auth/google");
    const data = await res.json();
    setLoading(false);
    if (data.authUrl) {
      window.location.href = data.authUrl;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#d9d2c7] p-6">
      <h3 className="text-lg font-semibold text-black mb-4">Google Workspace Integration</h3>
      <p className="text-sm text-[#d9d2c7] mb-4">
        Connect your Google account to enable calendar integration and team features.
      </p>
      
      {loading ? (
        <div className="flex items-center space-x-2 text-sm text-[#d9d2c7]">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#f3e89a]"></div>
          <span>Checking connection...</span>
        </div>
      ) : isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-[#f3e89a] rounded-full"></div>
            <span className="text-sm text-black">
              Connected to Google Workspace
              {isPersistent && (
                <span className="ml-2 text-xs bg-[#f3e89a]/20 text-black px-2 py-1 rounded">
                  Persistent
                </span>
              )}
            </span>
          </div>
          {calendarError && (
            <div className="bg-[#f3e89a]/10 border border-[#f3e89a]/20 rounded-lg p-3">
              <p className="text-sm text-black">
                Calendar access requires additional permissions. Please reconnect your account.
              </p>
            </div>
          )}
          <button
            onClick={handleConnect}
            className="text-sm text-[#f3e89a] hover:text-[#efe076] underline"
          >
            Reconnect Account
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="bg-[#f3e89a] hover:bg-[#efe076] text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Connect Google Workspace
        </button>
      )}
    </div>
  );
}

function EmailMonitoringSection() {
  const { user } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [recentEmails, setRecentEmails] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/email-monitor');
      const data = await response.json();
      
      if (data.success) {
        setRecentEmails(data.data.recentEmails || []);
      } else {
        setError(data.error || 'Failed to fetch email stats');
      }
    } catch (error) {
      setError('Failed to fetch email stats');
    }
  }, [user]);

  const triggerEmailProcessing = async () => {
    if (!user) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/email-monitor', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
        await fetchStats(); // Refresh stats
      } else {
        setError(data.error || 'Failed to process emails');
      }
    } catch (error) {
      setError('Failed to process emails');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Email Activity Monitoring</h3>
          <p className="text-sm text-gray-600 mt-1">
            Automatically log emails from contacts as activities
          </p>
        </div>
        <button
          onClick={triggerEmailProcessing}
          disabled={isProcessing}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {isProcessing ? 'Processing...' : 'Process Emails'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {stats && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-800 mb-2">Processing Results</h4>
          <div className="text-sm text-green-700">
            <p>Processed: {stats.processed} emails</p>
            <p>Logged: {stats.logged} activities</p>
            <p>Errors: {stats.errors}</p>
          </div>
        </div>
      )}

      {recentEmails.length > 0 ? (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Recent Contact Emails</h4>
          <div className="space-y-2">
            {recentEmails.slice(0, 5).map((email, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{email.subject || 'No Subject'}</p>
                    <p className="text-xs text-gray-600">{email.from}</p>
                    <p className="text-xs text-gray-500">{new Date(email.date).toLocaleString()}</p>
                    {email.matchedContacts && email.matchedContacts.length > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        📧 Matches: {email.matchedContacts.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Recent Contact Emails</h4>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              📧 No recent emails found from contacts in your database. 
              The system will automatically log emails when they come from your contacts.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>Auto-monitoring:</strong> Emails are automatically processed every 15 minutes for users with connected Google accounts.
        </p>
      </div>
    </div>
  );
}

function AdminPageContent() {
  const { user } = useUser();
  const { isAdmin, adminLoading } = useAdminAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Access Denied</h1>
          <p className="text-[#d9d2c7]">Please sign in to access the admin panel.</p>
        </div>
      </div>
    );
  }

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f3e89a] mx-auto mb-4"></div>
          <p className="text-[#d9d2c7]">Loading admin status...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Access Denied</h1>
          <p className="text-[#d9d2c7]">You don&apos;t have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#d9d2c7]/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black">Admin Dashboard</h1>
          <p className="text-[#d9d2c7] mt-2">Manage your workspace and integrations</p>
        </div>

        {/* Profile Management Section - Now at the top */}
        <div className="mb-8">
          <ProfileManagement />
        </div>

        {/* Integration Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <GoogleIntegrationSection />
          <EmailMonitoringSection />
        </div>

        {/* Monitoring Dashboard - Only for Analytics Admins */}
        {isAdmin && (
          <div className="mt-8">
            <MonitoringDashboard />
          </div>
        )}

        {/* Analytics Dashboard - Only for Analytics Admins */}
        {isAdmin && (
          <div className="mt-8">
            <AnalyticsDashboard />
          </div>
        )}

        {/* Regular User Message - For non-analytics admins */}
        {!isAdmin && (
          <div className="mt-8 p-6 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Workspace Management</h3>
            <p className="text-gray-600 mb-4">
              Use the sections above to manage your profile, company settings, and Google Workspace integration.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> Connect your Google Workspace to enable calendar integration and enhanced features.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <ConvexProviderWrapper>
      <AdminPageContent />
    </ConvexProviderWrapper>
  );
} 