"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

interface AnalyticsData {
  snapshots: Array<{
    date: string;
    costStats: {
      totalCost: number;
      totalRequests: number;
      costByModel: Record<string, number>;
    };
    rateLimitStats: {
      totalRequests: number;
      uniqueUsers: number;
      requestsByOperation: Record<string, number>;
    };
    userStats: {
      teamsCreated: number;
      contactsCreated: number;
      activitiesCreated: number;
      dealsCreated: number;
    };
  }>;
  currentDay: {
    costStats: {
      totalCost: number;
      totalRequests: number;
      costByModel: Record<string, number>;
    };
    rateLimitStats: {
      totalRequests: number;
      uniqueUsers: number;
      requestsByOperation: Record<string, number>;
    };
    userStats: {
      teamsCreated: number;
      contactsCreated: number;
      activitiesCreated: number;
      dealsCreated: number;
    };
  };
  days: number;
}

export default function AnalyticsDashboard() {
  const { user } = useUser();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Use available analytics functions
      const rateLimitStats = await convex.query(api.analytics.getRateLimitStats, { timeWindow: 7 * 24 * 60 * 60 * 1000 });
      const userActivityStats = await convex.query(api.analytics.getUserActivityStats, { timeWindow: 7 * 24 * 60 * 60 * 1000 });
      
      // Create mock data structure for now
      const mockData: AnalyticsData = {
        snapshots: [],
        currentDay: {
          costStats: {
            totalCost: 0,
            totalRequests: rateLimitStats.totalRequests,
            costByModel: {}
          },
          rateLimitStats,
          userStats: userActivityStats
        },
        days: 7
      };
      
      setAnalyticsData(mockData);
    } catch (error) {
      setError('Error fetching analytics data');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
  }, [user, fetchAnalyticsData]);

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  if (!user) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Analytics Dashboard</h2>
        <p className="text-gray-600">Please sign in to view analytics data.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Analytics Dashboard</h2>
        <button
          onClick={fetchAnalyticsData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {analyticsData ? (
        <div className="space-y-6">
          {/* Current Day Stats */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Today&apos;s Activity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600">Total Cost</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatCost(analyticsData.currentDay.costStats.totalCost)}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600">API Requests</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatNumber(analyticsData.currentDay.rateLimitStats.totalRequests)}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-600">Active Users</p>
                <p className="text-2xl font-bold text-purple-900">
                  {formatNumber(analyticsData.currentDay.rateLimitStats.uniqueUsers)}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-600">Records Created</p>
                <p className="text-2xl font-bold text-orange-900">
                  {formatNumber(
                    analyticsData.currentDay.userStats.contactsCreated +
                    analyticsData.currentDay.userStats.activitiesCreated +
                    analyticsData.currentDay.userStats.dealsCreated
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Cost by Model</h3>
            <div className="space-y-2">
              {Object.entries(analyticsData.currentDay.costStats.costByModel).map(([model, cost]) => (
                <div key={model} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{model}</span>
                  <span className="text-sm font-bold text-gray-900">{formatCost(cost)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* API Usage Breakdown */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">API Usage by Operation</h3>
            <div className="space-y-2">
              {Object.entries(analyticsData.currentDay.rateLimitStats.requestsByOperation).map(([operation, count]) => (
                <div key={operation} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{operation}</span>
                  <span className="text-sm font-bold text-gray-900">{formatNumber(count)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Historical Data */}
          {analyticsData.snapshots.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Last 7 Days</h3>
              <div className="space-y-3">
                {analyticsData.snapshots.slice(0, 7).map((snapshot) => (
                  <div key={snapshot.date} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">{snapshot.date}</span>
                      <span className="text-sm text-gray-500">
                        {formatCost(snapshot.costStats.totalCost)} • {formatNumber(snapshot.rateLimitStats.totalRequests)} requests
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Contacts:</span>
                        <span className="ml-1 font-medium">{snapshot.userStats.contactsCreated}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Activities:</span>
                        <span className="ml-1 font-medium">{snapshot.userStats.activitiesCreated}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Deals:</span>
                        <span className="ml-1 font-medium">{snapshot.userStats.dealsCreated}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Users:</span>
                        <span className="ml-1 font-medium">{snapshot.rateLimitStats.uniqueUsers}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">No analytics data available</p>
        </div>
      )}
    </div>
  );
} 