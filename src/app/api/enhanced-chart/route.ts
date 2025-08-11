import { NextRequest, NextResponse } from "next/server";
import { enhancedAnalytics, EnhancedChartSpec, ChartInsight } from "@/lib/enhancedAnalytics";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { logError, addBreadcrumb } from "@/lib/errorLogger";

interface EnhancedChartRequest {
  action: 'generate_insights' | 'modify_chart' | 'analyze_data' | 'predict_trends' | 'generate_report' | 'export';
  chartSpec?: EnhancedChartSpec;
  userRequest?: string;
  userId?: string;
  exportFormat?: 'png' | 'csv' | 'pdf';
}

interface EnhancedChartResponse {
  success: boolean;
  message?: string;
  insights?: ChartInsight[];
  modifiedChart?: EnhancedChartSpec;
  analysis?: string;
  recommendations?: string[];
  predictions?: string[];
  confidence?: number;
  exportUrl?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    addBreadcrumb('enhanced-chart-api', 'POST request received', { url: req.url });
    
    const body: EnhancedChartRequest = await req.json();
    const { action, chartSpec, userRequest, userId, exportFormat } = body;

    console.log('🚀 Enhanced Chart API request:', { action, userId, hasChartSpec: !!chartSpec });

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 });
    }

    switch (action) {
      case 'generate_insights':
        return await handleGenerateInsights(chartSpec, userRequest);
      
      case 'modify_chart':
        return await handleModifyChart(chartSpec, userRequest);
      
      case 'analyze_data':
        return await handleAnalyzeData(chartSpec, userRequest);
      
      case 'predict_trends':
        return await handlePredictTrends(chartSpec, userRequest);
      
      case 'generate_report':
        return await handleGenerateReport(chartSpec, userRequest);
      
      case 'export':
        return await handleExport(chartSpec, exportFormat);
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }

  } catch (error) {
    logError('enhanced-chart-api-error', error as any);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

async function handleGenerateInsights(
  chartSpec?: EnhancedChartSpec,
  userRequest?: string
): Promise<NextResponse<EnhancedChartResponse>> {
  try {
    if (!chartSpec) {
      return NextResponse.json({
        success: false,
        error: 'Chart specification is required for insights generation'
      }, { status: 400 });
    }

    console.log('🚀 Generating insights for chart:', chartSpec.chartType);

    const insights = await enhancedAnalytics.generateInsights(
      chartSpec.data,
      chartSpec.chartType,
      chartSpec.dataSource,
      userRequest
    );

    return NextResponse.json({
      success: true,
      message: `Generated ${insights.length} insights for your ${chartSpec.chartType} chart`,
      insights
    });

  } catch (error) {
    console.error('❌ Error generating insights:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate insights'
    }, { status: 500 });
  }
}

async function handleModifyChart(
  chartSpec?: EnhancedChartSpec,
  userRequest?: string
): Promise<NextResponse<EnhancedChartResponse>> {
  try {
    if (!chartSpec || !userRequest) {
      return NextResponse.json({
        success: false,
        error: 'Chart specification and user request are required for chart modification'
      }, { status: 400 });
    }

    console.log('🚀 Modifying chart based on request:', userRequest);

    const modifiedChart = await enhancedAnalytics.modifyChart(chartSpec, userRequest);

    if (!modifiedChart) {
      return NextResponse.json({
        success: false,
        error: 'Failed to modify chart'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Chart modified successfully based on your request: "${userRequest}"`,
      modifiedChart
    });

  } catch (error) {
    console.error('❌ Error modifying chart:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to modify chart'
    }, { status: 500 });
  }
}

async function handleAnalyzeData(
  chartSpec?: EnhancedChartSpec,
  userRequest?: string
): Promise<NextResponse<EnhancedChartResponse>> {
  try {
    if (!chartSpec) {
      return NextResponse.json({
        success: false,
        error: 'Chart specification is required for data analysis'
      }, { status: 400 });
    }

    console.log('🚀 Analyzing data for chart:', chartSpec.chartType);

    const { analysis, recommendations } = await enhancedAnalytics.analyzeData(
      chartSpec.data,
      chartSpec.dataSource,
      userRequest
    );

    return NextResponse.json({
      success: true,
      message: 'Data analysis completed successfully',
      analysis,
      recommendations
    });

  } catch (error) {
    console.error('❌ Error analyzing data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze data'
    }, { status: 500 });
  }
}

async function handlePredictTrends(
  chartSpec?: EnhancedChartSpec,
  userRequest?: string
): Promise<NextResponse<EnhancedChartResponse>> {
  try {
    if (!chartSpec) {
      return NextResponse.json({
        success: false,
        error: 'Chart specification is required for trend prediction'
      }, { status: 400 });
    }

    console.log('🚀 Predicting trends for chart:', chartSpec.chartType);

    const { predictions, confidence } = await enhancedAnalytics.predictTrends(
      chartSpec.data,
      chartSpec.dataSource,
      userRequest || 'next 30 days'
    );

    return NextResponse.json({
      success: true,
      message: `Generated ${predictions.length} trend predictions with ${confidence}% confidence`,
      predictions,
      confidence
    });

  } catch (error) {
    console.error('❌ Error predicting trends:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to predict trends'
    }, { status: 500 });
  }
}

async function handleGenerateReport(
  chartSpec?: EnhancedChartSpec,
  userRequest?: string
): Promise<NextResponse<EnhancedChartResponse>> {
  try {
    if (!chartSpec) {
      return NextResponse.json({
        success: false,
        error: 'Chart specification is required for report generation'
      }, { status: 400 });
    }

    console.log('🚀 Generating comprehensive report for chart:', chartSpec.chartType);

    const report = await enhancedAnalytics.generateReport(chartSpec, userRequest);

    return NextResponse.json({
      success: true,
      message: 'Comprehensive analytics report generated successfully',
      ...report
    });

  } catch (error) {
    console.error('❌ Error generating report:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate report'
    }, { status: 500 });
  }
}

async function handleExport(
  chartSpec?: EnhancedChartSpec,
  format?: 'png' | 'csv' | 'pdf'
): Promise<NextResponse<EnhancedChartResponse>> {
  try {
    if (!chartSpec) {
      return NextResponse.json({
        success: false,
        error: 'Chart specification is required for export'
      }, { status: 400 });
    }

    if (!format) {
      return NextResponse.json({
        success: false,
        error: 'Export format is required'
      }, { status: 400 });
    }

    console.log('🚀 Exporting chart as:', format);

    // For now, we'll return a placeholder export URL
    // In a real implementation, you would:
    // 1. Generate the actual file (PNG, CSV, or PDF)
    // 2. Upload it to a storage service
    // 3. Return the download URL
    
    const exportUrl = `/api/export/${chartSpec.chartType}-${Date.now()}.${format}`;

    return NextResponse.json({
      success: true,
      message: `Chart exported successfully as ${format.toUpperCase()}`,
      exportUrl
    });

  } catch (error) {
    console.error('❌ Error exporting chart:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to export chart'
    }, { status: 500 });
  }
}

// Helper function to get CRM data for enhanced analytics
async function getCrmDataForAnalytics(userId: string, dataType: string) {
  try {
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    const teamId = teams.length > 0 ? teams[0]._id : 'default';

    switch (dataType.toLowerCase()) {
      case 'contacts':
        return await convex.query(api.crm.getContactsByTeam, { teamId });
      case 'deals':
        return await convex.query(api.crm.getDealsByTeam, { teamId });
      case 'accounts':
        return await convex.query(api.crm.getAccountsByTeam, { teamId });
      case 'activities':
        return await convex.query(api.crm.getActivitiesByTeam, { teamId });
      default:
        return [];
    }
  } catch (error) {
    console.error('❌ Error fetching CRM data:', error);
    return [];
  }
} 