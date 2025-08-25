"use client";

import { useUser } from '@clerk/nextjs';
import ProfileManagement from '@/components/ProfileManagement';
import LinkedInIntegrationSection from '@/components/LinkedInIntegrationSection';
import GoogleWorkspaceIntegrationSection from '@/components/GoogleWorkspaceIntegrationSection';
import MonitoringDashboard from '@/components/MonitoringDashboard';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import RAGEvaluationDashboard from '@/components/RAGEvaluationDashboard';
import TeamManagement from '@/components/TeamManagement';
import DebugDashboard from '@/components/DebugDashboard';
import ConvexProviderWrapper from '@/components/ConvexProvider';
import ErrorBoundary from '@/components/ErrorBoundary';

// LinkedIn Integration Fallback Component
function LinkedInIntegrationFallback({ error, resetError }: { error?: Error; resetError: () => void }) {
  return (
    <div className="bg-neutral-primary rounded-lg shadow-sm border border-neutral-secondary p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary font-heading">LinkedIn Integration</h3>
          <p className="text-sm text-text-secondary mt-1 font-body">
            Connect your LinkedIn account to create and schedule posts
          </p>
        </div>
        <span className="px-2 py-1 text-xs bg-neutral-secondary text-text-secondary rounded">Not Connected</span>
      </div>
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800 font-body">
            Connect your LinkedIn account to enable AI-powered post creation and scheduling.
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/api/auth/linkedin'}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Connect LinkedIn Account
        </button>
      </div>
    </div>
  );
}

// LinkedIn Integration with Error Boundary
function LinkedInIntegrationWithErrorBoundary() {
  return (
    <ErrorBoundary fallback={LinkedInIntegrationFallback}>
      <LinkedInIntegrationSection />
    </ErrorBoundary>
  );
}

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
          <LinkedInIntegrationWithErrorBoundary />
        </div>

        {/* Monitoring and Analytics Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <MonitoringDashboard />
          <AnalyticsDashboard />
        </div>

        {/* RAG Evaluation Section */}
        <div className="mb-8">
          <RAGEvaluationDashboard />
        </div>

        {/* Team Management Section */}
        <div className="mb-8">
          <TeamManagement />
        </div>

        {/* Debug Dashboard Section */}
        <div className="mb-8">
          <DebugDashboard />
        </div>

        {/* Regular User Message */}
        <div className="mt-8 p-6 bg-neutral-secondary/10 rounded-lg">
          <h3 className="text-lg font-medium text-text-primary mb-2 font-heading">Workspace Management</h3>
          <p className="text-text-secondary mb-4 font-body">
            Use the sections above to manage your profile, company settings, integrations, and monitor your platform usage.
          </p>
          <div className="bg-accent-primary/10 border border-accent-primary/20 rounded-lg p-4">
            <p className="text-sm text-text-primary font-body">
              💡 <strong>Tip:</strong> Connect your Google Workspace and LinkedIn accounts to enable calendar events, email sending, and AI-powered post creation. Monitor your usage and costs in the analytics sections above.
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