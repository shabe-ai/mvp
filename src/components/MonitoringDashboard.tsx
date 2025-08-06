"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";

interface RateLimitStatus {
  userLimits: {
    minute: { count: number; limit: number; remaining: number };
    hour: { count: number; limit: number; remaining: number };
    day: { count: number; limit: number; remaining: number };
  };
  globalLimits: {
    minute: { count: number; limit: number; remaining: number };
    hour: { count: number; limit: number; remaining: number };
    day: { count: number; limit: number; remaining: number };
  };
}

interface CostStats {
  totalCost: number;
  totalRequests: number;
  averageCostPerRequest: number;
  costByModel: Record<string, number>;
}

export default function MonitoringDashboard() {
  const { user } = useUser();
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);
  const [costStats, setCostStats] = useState<CostStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMonitoringData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/monitoring?timeWindow=24h');
      if (response.ok) {
        const data = await response.json();
        console.log('Monitoring data received:', data);
        setRateLimitStatus(data.data.rateLimitStatus);
        setCostStats(data.data.costStats);
      } else {
        const errorData = await response.json();
        setError(`Failed to fetch monitoring data: ${errorData.message || response.statusText}`);
      }
    } catch (error) {
      setError('Error fetching monitoring data');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchMonitoringData();
    }
  }, [user, fetchMonitoringData]);

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (!user) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Monitoring Dashboard</h2>
        <p className="text-gray-600">Please sign in to view monitoring data.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Monitoring Dashboard</h2>
        <button
          onClick={fetchMonitoringData}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rate Limits */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Rate Limits</h3>
          
          {rateLimitStatus && rateLimitStatus.userLimits ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">User Limits</h4>
                <div className="space-y-3">
                  {Object.entries(rateLimitStatus.userLimits).map(([period, data]) => (
                    <div key={period} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 capitalize">{period}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-900">
                          {data.count}/{data.limit}
                        </span>
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getUsageColor(getUsagePercentage(data.count, data.limit))}`}
                            style={{ width: `${getUsagePercentage(data.count, data.limit)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Global Limits</h4>
                <div className="space-y-3">
                  {rateLimitStatus.globalLimits && Object.entries(rateLimitStatus.globalLimits).map(([period, data]) => (
                    <div key={period} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 capitalize">{period}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-900">
                          {data.count}/{data.limit}
                        </span>
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getUsageColor(getUsagePercentage(data.count, data.limit))}`}
                            style={{ width: `${getUsagePercentage(data.count, data.limit)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-500">No rate limit data available</p>
              {rateLimitStatus && (
                <p className="text-xs text-gray-400">
                  Debug: {JSON.stringify(rateLimitStatus, null, 2)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Cost Tracking */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Cost Tracking (24h)</h3>
          
          {costStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600">Total Cost</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCost(costStats.totalCost)}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600">Total Requests</p>
                  <p className="text-2xl font-bold text-green-900">
                    {costStats.totalRequests}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Average Cost per Request</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCost(costStats.averageCostPerRequest)}
                </p>
              </div>

              {Object.keys(costStats.costByModel).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Cost by Model</h4>
                  <div className="space-y-2">
                    {Object.entries(costStats.costByModel).map(([model, cost]) => (
                      <div key={model} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{model}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCost(cost)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No cost data available</p>
          )}
        </div>
      </div>
    </div>
  );
} 