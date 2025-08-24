"use client";
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import ProfileManagement from '@/components/ProfileManagement';
import GoogleIntegrationSection from '@/components/GoogleIntegrationSection';
import EmailMonitoringSection from '@/components/EmailMonitoringSection';
import LinkedInIntegrationSection from '@/components/LinkedInIntegrationSection';
import ConvexProviderWrapper from '@/components/ConvexProvider';

function AdminPageContent() {
  const { user } = useUser();
  const { isAdmin, adminLoading } = useAdminAuth();

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

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-neutral-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary mx-auto mb-4"></div>
          <p className="text-text-secondary font-body">Loading admin status...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-4 font-heading">Access Denied</h1>
          <p className="text-text-secondary font-body">You don&apos;t have permission to access the admin panel.</p>
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
          <GoogleIntegrationSection />
          <EmailMonitoringSection />
          <LinkedInIntegrationSection />
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
          <div className="mt-8 p-6 bg-neutral-secondary/10 rounded-lg">
            <h3 className="text-lg font-medium text-text-primary mb-2 font-heading">Workspace Management</h3>
            <p className="text-text-secondary mb-4 font-body">
              Use the sections above to manage your profile, company settings, and Google Workspace integration.
            </p>
            <div className="bg-accent-primary/10 border border-accent-primary/20 rounded-lg p-4">
              <p className="text-sm text-text-primary font-body">
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