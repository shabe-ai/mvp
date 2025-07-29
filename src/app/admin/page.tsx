"use client";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

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
    <section className="bg-white rounded-lg shadow p-6 border border-slate-100 mb-6">
      <h2 className="text-xl font-semibold mb-2">Google Workspace Integration</h2>
      <p className="text-gray-600 mb-4">Connect your Google account to enable Gmail and Google Drive features.</p>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Connection Status</h3>
            <p className="text-sm text-gray-600">
              {isConnected === null ? "Checking..." : 
               isConnected ? "✅ Connected" : "❌ Not connected"}
            </p>
          </div>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect Google Account"}
          </button>
        </div>

        {calendarError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ Calendar access requires additional permissions. Please reconnect your Google account.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function GoogleDriveSection() {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    checkConnection();
  }, [user]);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/test-token");
      const data = await res.json();
      setIsConnected(!!data.hasToken);
    } catch {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      setError("Failed to connect Google account");
    } finally {
      setLoading(false);
    }
  };

  const testDriveConnection = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/drive?action=folders");
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setError(null);
        alert("Google Drive connection successful! You can now use the integration in the main chat.");
      }
    } catch {
      setError("Failed to connect to Google Drive");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-6 border border-slate-100 mb-6">
      <h2 className="text-xl font-semibold mb-2">Google Drive Integration</h2>
      <p className="text-gray-600 mb-4">Connect your Google Drive to enable AI-powered document analysis.</p>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Connection Status</h3>
            <p className="text-sm text-gray-600">
              {isConnected === null ? "Checking..." : 
               isConnected ? "✅ Connected" : "❌ Not connected"}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={testDriveConnection}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Testing..." : "Test Google Drive Connection"}
            </button>
            <button
              onClick={handleConnect}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Connecting..." : "Reconnect Google Account"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Tip</h4>
          <p className="text-sm text-blue-700">
            The Google Drive integration is now available in the main chat interface. 
            Go to the Home page to connect your Google Drive and process documents for AI context.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function AdminPage() {
  return (
    <div className="max-w-3xl mx-auto py-12">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <SignedIn>
        <div className="space-y-8">
          {/* Google Integration Section */}
          <GoogleIntegrationSection />

          {/* Team Details Section */}
          <section className="bg-white rounded-lg shadow p-6 border border-slate-100 mb-6">
            <h2 className="text-xl font-semibold mb-2">Team Details</h2>
            <p className="text-gray-600 mb-2">View and manage your team information.</p>
            {/* TODO: Add team details UI here */}
            <div className="text-sm text-gray-400">(Team details UI coming soon)</div>
          </section>

          {/* Google Drive Integration Section */}
          <GoogleDriveSection />

          {/* Future Admin Features */}
          <section className="bg-white rounded-lg shadow p-6 border border-slate-100">
            <h2 className="text-xl font-semibold mb-2">More Admin Features</h2>
            <div className="text-sm text-gray-400">(More admin features coming soon)</div>
          </section>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Admin Access</h2>
          <p className="mb-6 text-gray-600">Please sign in to access admin features.</p>
          <SignInButton mode="modal">
            <button className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>
    </div>
  );
} 