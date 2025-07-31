"use client";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import TeamManagement from "@/components/TeamManagement";

function GoogleIntegrationSection() {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [calendarError, setCalendarError] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch("/api/test-token")
      .then(res => res.json())
      .then(data => {
        setIsConnected(!!data.hasToken);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Google Workspace Integration</h3>
        <p className="text-sm text-gray-600 mb-4">
          Connect your Google account to enable calendar integration and team features.
        </p>
        
        {loading ? (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            <span>Checking connection...</span>
          </div>
        ) : isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-700">Connected to Google Workspace</span>
            </div>
            {calendarError && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  Calendar access requires additional permissions. Please reconnect your account.
                </p>
              </div>
            )}
            <button
              onClick={handleConnect}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Reconnect Account
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Access Required</h1>
          <p className="text-gray-600 mb-6">Please sign in to access the admin panel.</p>
          <SignInButton>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium">
              Sign In
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your workspace and integrations</p>
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