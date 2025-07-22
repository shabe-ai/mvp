import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Chat from "@/components/Chat";

export default function AdminPage() {
  return (
    <div className="max-w-3xl mx-auto py-12">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <SignedIn>
        <div className="space-y-8">
          {/* Google Integration Section */}
          <section className="bg-white rounded-lg shadow p-6 border border-slate-100 mb-6">
            <h2 className="text-xl font-semibold mb-2">Google Integration</h2>
            <p className="text-gray-600 mb-2">Connect your Google account to enable Gmail features.</p>
            {/* TODO: Add Google OAuth connect button/component here */}
            <div className="text-sm text-gray-400">(Google integration UI coming soon)</div>
          </section>

          {/* Team Details Section */}
          <section className="bg-white rounded-lg shadow p-6 border border-slate-100 mb-6">
            <h2 className="text-xl font-semibold mb-2">Team Details</h2>
            <p className="text-gray-600 mb-2">View and manage your team information.</p>
            {/* Team management UI */}
            <Chat hideTeamSelector={false} />
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