import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

function GoogleIntegrationSection() {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      <p className="text-gray-600 mb-2">Connect your Google account to enable Gmail features.</p>
      {loading ? (
        <div className="text-gray-400">Checking connection...</div>
      ) : isConnected ? (
        <div className="text-green-600 font-medium">✅ Google account connected!</div>
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