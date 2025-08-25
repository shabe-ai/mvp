"use client";

import { useUser } from '@clerk/nextjs';
import ProfileManagement from '@/components/ProfileManagement';
import LinkedInIntegrationSection from '@/components/LinkedInIntegrationSection';
import GoogleWorkspaceIntegrationSection from '@/components/GoogleWorkspaceIntegrationSection';
import ConvexProviderWrapper from '@/components/ConvexProvider';

function AdminPageContent() {
  const { user } = useUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-4 font-heading">Access Denied</h1>
          <p className="text-text-secondary font-body">Please sign in to access the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-secondary/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary font-heading">Admin Dashboard</h1>
          <p className="text-text-secondary mt-2 font-body">Manage your workspace and integrations</p>
        </div>

        {/* Profile Management Section - Now at the top */}
        <div className="mb-8">
          <ProfileManagement />
        </div>

        {/* Integration Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <GoogleWorkspaceIntegrationSection />
          {/* Temporarily disabled due to Convex error */}
          {/* <LinkedInIntegrationSection /> */}
        </div>

        {/* Regular User Message */}
        <div className="mt-8 p-6 bg-neutral-secondary/10 rounded-lg">
          <h3 className="text-lg font-medium text-text-primary mb-2 font-heading">Workspace Management</h3>
          <p className="text-text-secondary mb-4 font-body">
            Use the sections above to manage your profile, company settings, and integrations.
          </p>
          <div className="bg-accent-primary/10 border border-accent-primary/20 rounded-lg p-4">
            <p className="text-sm text-text-primary font-body">
              💡 <strong>Tip:</strong> Connect your Google Workspace and LinkedIn accounts to enable calendar events, email sending, and AI-powered post creation.
            </p>
          </div>
        </div>
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