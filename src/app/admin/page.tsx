"use client";
import { useUser } from "@clerk/nextjs";
import { useState, useEffect, useCallback } from "react";
import MonitoringDashboard from "@/components/MonitoringDashboard";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import { useAdminAuth } from "@/lib/adminAuth";

function ProfileSection() {
  const { user } = useUser();

  if (!user) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#d9d2c7] p-6">
      <h3 className="text-lg font-semibold text-black mb-4">Profile</h3>
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-[#f3e89a] rounded-full flex items-center justify-center">
            <span className="text-black font-semibold text-lg">
              {user.firstName?.charAt(0) || user.emailAddresses[0]?.emailAddress.charAt(0) || 'U'}
            </span>
          </div>
          <div>
            <h4 className="text-black font-medium">
              {user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user.emailAddresses[0]?.emailAddress || 'User'
              }
            </h4>
            <p className="text-sm text-[#d9d2c7]">
              {user.emailAddresses[0]?.emailAddress}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">First Name</label>
            <p className="text-sm text-[#d9d2c7]">{user.firstName || 'Not provided'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Last Name</label>
            <p className="text-sm text-[#d9d2c7]">{user.lastName || 'Not provided'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Email</label>
            <p className="text-sm text-[#d9d2c7]">{user.emailAddresses[0]?.emailAddress}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Member Since</label>
            <p className="text-sm text-[#d9d2c7]">
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanySection() {
  const [companyData, setCompanyData] = useState({
    name: '',
    website: '',
    description: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load company data from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('companyData');
    if (saved) {
      setCompanyData(JSON.parse(saved));
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    localStorage.setItem('companyData', JSON.stringify(companyData));
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    // Reset to saved data
    const saved = localStorage.getItem('companyData');
    if (saved) {
      setCompanyData(JSON.parse(saved));
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#d9d2c7] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-black">Company</h3>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-[#f3e89a] hover:text-[#efe076] underline"
          >
            Edit
          </button>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={handleCancel}
              className="text-sm text-[#d9d2c7] hover:text-black"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="text-sm bg-[#f3e89a] hover:bg-[#efe076] text-black px-3 py-1 rounded disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-black mb-1">Company Name</label>
          {isEditing ? (
            <input
              type="text"
              value={companyData.name}
              onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-[#d9d2c7] rounded-lg focus:ring-2 focus:ring-[#f3e89a] focus:border-transparent"
              placeholder="Enter company name"
            />
          ) : (
            <p className="text-sm text-[#d9d2c7]">{companyData.name || 'Not provided'}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-black mb-1">Website</label>
          {isEditing ? (
            <input
              type="url"
              value={companyData.website}
              onChange={(e) => setCompanyData(prev => ({ ...prev, website: e.target.value }))}
              className="w-full px-3 py-2 border border-[#d9d2c7] rounded-lg focus:ring-2 focus:ring-[#f3e89a] focus:border-transparent"
              placeholder="https://example.com"
            />
          ) : (
            <p className="text-sm text-[#d9d2c7]">
              {companyData.website ? (
                <a href={companyData.website} target="_blank" rel="noopener noreferrer" className="text-[#f3e89a] hover:text-[#efe076]">
                  {companyData.website}
                </a>
              ) : 'Not provided'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-black mb-1">Description</label>
          {isEditing ? (
            <textarea
              value={companyData.description}
              onChange={(e) => setCompanyData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-[#d9d2c7] rounded-lg focus:ring-2 focus:ring-[#f3e89a] focus:border-transparent"
              placeholder="Describe your company..."
            />
          ) : (
            <p className="text-sm text-[#d9d2c7]">{companyData.description || 'Not provided'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

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

export default function AdminPage() {
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <ProfileSection />
            <CompanySection />
          </div>
          
          <div className="space-y-8">
            <GoogleIntegrationSection />
            <EmailMonitoringSection />
          </div>
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