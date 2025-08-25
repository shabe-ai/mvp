"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { 
  BarChart3, 
  TrendingUp, 
  Brain, 
  Target, 
  CheckCircle, 
  AlertCircle,
  Download,
  RefreshCw
} from 'lucide-react';

interface RAGOverview {
  overview: {
    totalInteractions: number;
    successRate: string;
    averageConfidence: string;
    improvement: string;
  };
  learning: {
    totalExamples: number;
    patternsLearned: number;
    recentImprovements: string;
  };
  domains: {
    general: number;
    charts: number;
    analysis: number;
    crm: number;
    conversations: number;
  };
}

interface RAGEvaluation {
  beforeRAG: {
    successRate: number;
    averageClarifications: number;
    userSatisfaction: number;
  };
  afterRAG: {
    successRate: number;
    averageClarifications: number;
    userSatisfaction: number;
  };
  improvement: {
    successRateImprovement: number;
    clarificationReduction: number;
    satisfactionImprovement: number;
  };
}

export default function RAGEvaluationDashboard() {
  const { user } = useUser();
  const [overview, setOverview] = useState<RAGOverview | null>(null);
  const [evaluation, setEvaluation] = useState<RAGEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'evaluation' | 'details'>('overview');

  // Access control - only show to specific user
  const AUTHORIZED_USER_ID = 'user_30yNzzaqY36tW07nKprV52twdEQ'; // Your user ID
  
  // If not authorized user, don't render anything
  if (!user || user.id !== AUTHORIZED_USER_ID) {
    return null;
  }

  useEffect(() => {
    fetchRAGData();
  }, []);

  const fetchRAGData = async () => {
    try {
      setLoading(true);
      
      // Fetch overview data
      const overviewResponse = await fetch('/api/rag-evaluation?action=overview');
      const overviewData = await overviewResponse.json();
      
      if (overviewData.success) {
        setOverview(overviewData.data);
      }
      
      // Fetch evaluation data
      const evaluationResponse = await fetch('/api/rag-evaluation?action=evaluation');
      const evaluationData = await evaluationResponse.json();
      
      if (evaluationData.success) {
        setEvaluation(evaluationData.data);
      }
      
    } catch (error) {
      console.error('Error fetching RAG data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSuccessRateColor = (rate: string) => {
    const numRate = parseFloat(rate);
    if (numRate >= 80) return 'text-green-600';
    if (numRate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getImprovementColor = (improvement: string) => {
    const numImprovement = parseFloat(improvement);
    if (numImprovement > 0) return 'text-green-600';
    if (numImprovement < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading RAG evaluation data...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Brain className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">RAG System Evaluation</h2>
          </div>
          <button
            onClick={fetchRAGData}
            className="flex items-center space-x-2 px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'evaluation', label: 'Evaluation', icon: TrendingUp },
            { id: 'details', label: 'Details', icon: Target }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Success Rate</span>
                </div>
                <p className={`text-2xl font-bold ${getSuccessRateColor(overview.overview.successRate)}`}>
                  {overview.overview.successRate}
                </p>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Interactions</span>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {overview.overview.totalInteractions}
                </p>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Examples</span>
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  {overview.learning.totalExamples}
                </p>
              </div>
              
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-medium text-orange-900">Improvement</span>
                </div>
                <p className={`text-2xl font-bold ${getImprovementColor(overview.overview.improvement)}`}>
                  {overview.overview.improvement}
                </p>
              </div>
            </div>

            {/* Domain Breakdown */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning by Domain</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(overview.domains).map(([domain, count]) => (
                  <div key={domain} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-sm font-medium text-gray-600 capitalize">{domain}</p>
                    <p className="text-xl font-bold text-gray-900">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'evaluation' && evaluation && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Before vs After RAG</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Success Rate */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Success Rate</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Before:</span>
                    <span className="text-sm font-medium">{evaluation.beforeRAG.successRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">After:</span>
                    <span className="text-sm font-medium text-green-600">{evaluation.afterRAG.successRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-medium">Improvement:</span>
                    <span className={`text-sm font-bold ${evaluation.improvement.successRateImprovement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {evaluation.improvement.successRateImprovement > 0 ? '+' : ''}{evaluation.improvement.successRateImprovement.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Clarifications */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Clarifications Needed</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Before:</span>
                    <span className="text-sm font-medium">{evaluation.beforeRAG.averageClarifications.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">After:</span>
                    <span className="text-sm font-medium text-green-600">{evaluation.afterRAG.averageClarifications.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-medium">Reduction:</span>
                    <span className={`text-sm font-bold ${evaluation.improvement.clarificationReduction > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {evaluation.improvement.clarificationReduction > 0 ? '+' : ''}{evaluation.improvement.clarificationReduction.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* User Satisfaction */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">User Satisfaction</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Before:</span>
                    <span className="text-sm font-medium">{evaluation.beforeRAG.userSatisfaction.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">After:</span>
                    <span className="text-sm font-medium text-green-600">{evaluation.afterRAG.userSatisfaction.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-medium">Improvement:</span>
                    <span className={`text-sm font-bold ${evaluation.improvement.satisfactionImprovement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {evaluation.improvement.satisfactionImprovement > 0 ? '+' : ''}{evaluation.improvement.satisfactionImprovement.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Detailed Performance</h3>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-4">
                Detailed performance metrics and learning patterns will be displayed here.
                This includes domain-specific performance, learning curves, and pattern recognition effectiveness.
              </p>
              
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <AlertCircle className="w-4 h-4" />
                <span>Detailed metrics are being collected and will be available soon.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 