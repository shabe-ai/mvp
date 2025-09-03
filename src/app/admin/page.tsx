"use client";

import { useUser } from '@clerk/nextjs';
import ProfileManagement from '@/components/ProfileManagement';
import LinkedInIntegrationSection from '@/components/LinkedInIntegrationSection';
import GoogleWorkspaceIntegrationSection from '@/components/GoogleWorkspaceIntegrationSection';
import MonitoringDashboard from '@/components/MonitoringDashboard';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import RAGEvaluationDashboard from '@/components/RAGEvaluationDashboard';
import TeamManagement from '@/components/TeamManagement';
// Debug dashboard removed - not used
// import DebugDashboard from '@/components/DebugDashboard';
import ConvexProviderWrapper from '@/components/ConvexProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Card } from '@/components/shabe-ui';

// LinkedIn Integration Fallback Component
function LinkedInIntegrationFallback({ error, resetError }: { error?: Error; resetError: () => void }) {
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">LinkedIn Integration</h3>
            <p className="text-sm text-ink-600 mt-1">
              Connect your LinkedIn account to create and schedule posts
            </p>
          </div>
          <span className="px-2 py-1 text-xs bg-accent-100 text-ink-700 rounded-pill">Not Connected</span>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-accent-50 border border-line-200 rounded-ctl">
            <p className="text-sm text-ink-700">
              Connect your LinkedIn account to enable AI-powered post creation and scheduling.
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/api/auth/linkedin'}
            className="bg-accent-500 hover:bg-accent-600 text-black px-4 py-2 rounded-ctl text-sm font-medium transition-colors"
          >
            Connect LinkedIn Account
          </button>
        </div>
      </div>
    </Card>
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

// Debug Dashboard Fallback Component - removed
// function DebugDashboardFallback({ error, resetError }: { error?: Error; resetError: () => void }) {
//   return (
//     <div className="p-4 bg-danger-50 border border-danger-500 rounded-ctl">
//       <p className="text-sm text-danger-500">❌ Debug Dashboard failed to load</p>
//       {error && <p className="text-xs text-danger-500 mt-1">Error: {error.message}</p>}
//     </div>
//   );
// }

function AdminPageContent() {
  const { user } = useUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-ink-900 mb-4">Access Denied</h1>
          <p className="text-ink-600">Please sign in to access the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
          <div className="min-h-screen bg-bg">
        <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header removed for cleaner design */}

        {/* Profile Management Section */}
        <div className="mb-6">
          <ProfileManagement />
        </div>

        {/* Integration Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <GoogleWorkspaceIntegrationSection />
          <LinkedInIntegrationWithErrorBoundary />
        </div>

        {/* Monitoring and Analytics Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <MonitoringDashboard />
          <AnalyticsDashboard />
        </div>

        {/* RAG Evaluation Section */}
        <div className="mb-6">
          <RAGEvaluationDashboard />
        </div>

        {/* Team Management Section */}
        <div className="mb-6">
          <TeamManagement />
        </div>

        {/* Debug Dashboard Section - removed for v2 launch */}
        {/* <div className="mb-8">
          <div className="p-4 bg-warning-50 border border-warning-500 rounded-ctl mb-4">
            <p className="text-sm text-warning-500">
              🔍 Debug: Debug Dashboard should appear below this message
            </p>
          </div>
          <ErrorBoundary fallback={DebugDashboardFallback}>
            <DebugDashboard />
          </ErrorBoundary>
        </div> */}

        {/* Workspace management section removed for cleaner design */}
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