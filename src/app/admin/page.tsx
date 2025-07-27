"use client";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

function GoogleIntegrationSection() {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
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
      <h2 className="text-xl font-semibold mb-2">Google Integration</h2>
      <p className="text-gray-600 mb-2">Connect your Google account to enable Gmail and Calendar features.</p>
      {loading ? (
        <div className="text-gray-400">Checking connection...</div>
      ) : isConnected ? (
        <>
          <div className="text-green-600 font-medium">✅ Google account connected!</div>
          {calendarError && (
            <button
              onClick={handleConnect}
              className="mt-3 px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
            >
              Reconnect Google to enable Calendar features
            </button>
          )}
        </>
      ) : (
        <button
          onClick={handleConnect}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Connect Google Account
        </button>
      )}
    </section>
  );
}

function GoogleDriveSection() {
  const { user } = useUser();
  const [folders, setFolders] = useState<Array<{id: string; name: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testDriveConnection = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/drive?action=folders", {
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setFolders(data.folders || []);
      }
    } catch (err) {
      console.error('Drive connection error:', err);
      setError("Failed to connect to Google Drive");
    } finally {
      setLoading(false);
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
    <div>
      {loading ? (
        <div className="text-gray-400">Testing Google Drive connection...</div>
      ) : error ? (
        <div className="text-red-600 mb-3">{error}</div>
      ) : folders.length > 0 ? (
        <div className="text-green-600 font-medium mb-3">
          ✅ Google Drive connected! Found {folders.length} folders.
        </div>
      ) : null}
      
      <div className="space-y-2">
        <button
          onClick={testDriveConnection}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? "Testing..." : "Test Google Drive Connection"}
        </button>
        
        {error && error.includes("insufficient authentication scopes") && (
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
          >
            Reconnect Google to enable Drive features
          </button>
        )}
      </div>
      
      {folders.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Available Folders:</h3>
          <div className="space-y-1">
            {folders.slice(0, 5).map((folder) => (
              <div key={folder.id} className="text-sm text-gray-600">
                📁 {folder.name}
              </div>
            ))}
            {folders.length > 5 && (
              <div className="text-sm text-gray-500">
                ... and {folders.length - 5} more folders
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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
          <section className="bg-white rounded-lg shadow p-6 border border-slate-100">
            <h2 className="text-xl font-semibold mb-2">Google Drive Integration</h2>
            <p className="text-gray-600 mb-2">Connect your Google Drive to enable AI-powered document analysis.</p>
            <GoogleDriveSection />
          </section>

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