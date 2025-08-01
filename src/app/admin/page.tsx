"use client";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import TeamManagement from "@/components/TeamManagement";

function GoogleIntegrationSection() {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isPersistent, setIsPersistent] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [calendarError, setCalendarError] = useState(false);

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
  }, [user]);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/test-token");
      const data = await res.json();
      setIsConnected(!!data.hasToken);
      setIsPersistent(!!data.persistentConnection);
      setLoading(false);
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsConnected(false);
      setIsPersistent(false);
    }
  };

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
    <div className="space-y-6">
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
    </div>
  );
}

export default function AdminPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#d9d2c7]/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f3e89a]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#d9d2c7]/20 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Admin Access Required</h1>
          <p className="text-[#d9d2c7] mb-6">Please sign in to access the admin panel.</p>
          <SignInButton>
            <button className="bg-[#f3e89a] hover:bg-[#efe076] text-black px-6 py-2 rounded-lg font-medium transition-colors">
              Sign In
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#d9d2c7]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black">Admin Dashboard</h1>
          <p className="text-[#d9d2c7] mt-2">Manage your workspace and integrations</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <GoogleIntegrationSection />
          </div>
          
          <div>
            <TeamManagement />
          </div>
        </div>
      </div>
    </div>
  );
} 