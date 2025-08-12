import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ragMonitor } from '@/lib/ragMonitor';
import { userDataEnhancer } from '@/lib/userDataEnhancer';
import { specializedRAG } from '@/lib/specializedRAG';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'overview';

    switch (action) {
      case 'overview':
        return await getOverview();
      case 'detailed':
        return await getDetailedBreakdown();
      case 'evaluation':
        return await getEvaluationReport();
      case 'examples':
        return await getExamples();
      case 'stats':
        return await getStats();
      default:
        return await getOverview();
    }

  } catch (error) {
    console.error('❌ RAG Evaluation API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getOverview() {
  const currentMetrics = await ragMonitor.getCurrentMetrics();
  const userDataStats = userDataEnhancer.getStats();
  const specializedStats = specializedRAG.getStats();

  return NextResponse.json({
    success: true,
    data: {
      overview: {
        totalInteractions: currentMetrics.totalInteractions,
        successRate: currentMetrics.successRate.toFixed(2) + '%',
        averageConfidence: currentMetrics.averageConfidence.toFixed(2),
        improvement: currentMetrics.learningProgress.improvements.toFixed(2) + '%'
      },
      learning: {
        totalExamples: userDataStats.totalExamples + 
                      specializedStats.chartExamples + 
                      specializedStats.analysisExamples + 
                      specializedStats.crmExamples,
        patternsLearned: currentMetrics.learningProgress.patternsLearned,
        recentImprovements: currentMetrics.learningProgress.improvements.toFixed(2) + '%'
      },
      domains: {
        general: userDataStats.totalExamples,
        charts: specializedStats.chartExamples,
        analysis: specializedStats.analysisExamples,
        crm: specializedStats.crmExamples,
        conversations: specializedStats.conversationExamples
      }
    }
  });
}

async function getDetailedBreakdown() {
  const breakdown = await ragMonitor.getDetailedBreakdown();
  
  return NextResponse.json({
    success: true,
    data: breakdown
  });
}

async function getEvaluationReport() {
  const evaluation = await ragMonitor.generateEvaluationReport();
  
  return NextResponse.json({
    success: true,
    data: evaluation
  });
}

async function getExamples() {
  const userDataExamples = userDataEnhancer.exportExamples();
  const specializedStats = specializedRAG.getStats();
  
  return NextResponse.json({
    success: true,
    data: {
      generalExamples: userDataExamples.slice(-10), // Last 10 examples
      specializedStats: specializedStats,
      totalExamples: userDataExamples.length + 
                    specializedStats.chartExamples + 
                    specializedStats.analysisExamples + 
                    specializedStats.crmExamples
    }
  });
}

async function getStats() {
  const userDataStats = userDataEnhancer.getStats();
  const specializedStats = specializedRAG.getStats();
  
  return NextResponse.json({
    success: true,
    data: {
      userData: userDataStats,
      specialized: specializedStats,
      combined: {
        totalExamples: userDataStats.totalExamples + 
                      specializedStats.chartExamples + 
                      specializedStats.analysisExamples + 
                      specializedStats.crmExamples,
        successfulExamples: userDataStats.successfulExamples,
        failedExamples: userDataStats.failedExamples
      }
    }
  });
} 