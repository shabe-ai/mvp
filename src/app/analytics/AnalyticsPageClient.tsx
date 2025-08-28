"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, Button, Input, Textarea, inputClass } from "@/components/shabe-ui";
import ChartDisplay from "@/components/ChartDisplay";
import { 
  RefreshCw,
  Download,
  Save,
  Settings,
  Plus,
  BarChart3,
  Maximize2,
  X
} from "lucide-react";

interface ChartWidget {
  id: string;
  title: string;
  prompt: string;
  chartType: 'bar' | 'line' | 'pie' | 'area';
  data: any[];
  xAxisKey: string;
  yAxisKey: string;
  lastUpdated: Date;
  isActive: boolean;
}

export default function AnalyticsPageClient() {
  const { user } = useUser();
  const [widgets, setWidgets] = useState<ChartWidget[]>([]);
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fullscreenWidget, setFullscreenWidget] = useState<ChartWidget | null>(null);

  // Get user's team data
  const teams = useQuery(api.crm.getTeamsByUser, user?.id ? { userId: user.id } : "skip");
  const teamId = teams && teams.length > 0 ? teams[0]._id : null;

  // Fetch CRM data from Convex
  const contacts = useQuery(
    api.crm.getContactsByTeam, 
    teamId ? { teamId: teamId.toString() } : "skip"
  );
  const accounts = useQuery(
    api.crm.getAccountsByTeam, 
    teamId ? { teamId: teamId.toString() } : "skip"
  );
  const deals = useQuery(
    api.crm.getDealsByTeam, 
    teamId ? { teamId: teamId.toString() } : "skip"
  );
  const activities = useQuery(
    api.crm.getActivitiesByTeam, 
    teamId ? { teamId: teamId.toString() } : "skip"
  );

  // Initialize 6 empty widgets
  useEffect(() => {
    const emptyWidgets: ChartWidget[] = Array.from({ length: 6 }, (_, index) => ({
      id: `widget-${index + 1}`,
      title: '',
      prompt: '',
      chartType: 'bar',
      data: [],
      xAxisKey: 'stage',
      yAxisKey: 'amount',
      lastUpdated: new Date(),
      isActive: false
    }));
    setWidgets(emptyWidgets);
  }, []);

  // Load saved widgets from localStorage
  useEffect(() => {
    // Clear localStorage to start fresh with empty widgets
    localStorage.removeItem('analytics-widgets');
  }, []);

  // Data processing functions
  const processDataFromPrompt = (prompt: string): { data: any[], chartType: 'bar' | 'line' | 'pie' | 'area', xAxisKey: string, yAxisKey: string } => {
    const lowerPrompt = prompt.toLowerCase();
    
    // Determine chart type based on prompt
    let chartType: 'bar' | 'line' | 'pie' | 'area' = 'bar';
    if (lowerPrompt.includes('trend') || lowerPrompt.includes('over time') || lowerPrompt.includes('growth')) {
      chartType = 'line';
    } else if (lowerPrompt.includes('distribution') || lowerPrompt.includes('percentage') || lowerPrompt.includes('proportion')) {
      chartType = 'pie';
    } else if (lowerPrompt.includes('revenue') || lowerPrompt.includes('amount') || lowerPrompt.includes('value')) {
      chartType = 'area';
    }

    // Process data based on prompt content
    if (lowerPrompt.includes('contact') || lowerPrompt.includes('lead')) {
      if (lowerPrompt.includes('growth') || lowerPrompt.includes('over time')) {
        return {
          chartType: 'line',
          data: processContactsData(contacts || []),
          xAxisKey: 'month',
          yAxisKey: 'contacts'
        };
      } else if (lowerPrompt.includes('status') || lowerPrompt.includes('conversion')) {
        return {
          chartType: 'pie',
          data: processConversionData(contacts || []),
          xAxisKey: 'status',
          yAxisKey: 'count'
        };
      }
    } else if (lowerPrompt.includes('deal') || lowerPrompt.includes('pipeline')) {
      if (lowerPrompt.includes('stage')) {
        return {
          chartType: 'bar',
          data: processDealsData(deals || []),
          xAxisKey: 'stage',
          yAxisKey: 'amount'
        };
      } else if (lowerPrompt.includes('revenue') || lowerPrompt.includes('amount')) {
        return {
          chartType: 'area',
          data: processRevenueData(deals || []),
          xAxisKey: 'month',
          yAxisKey: 'revenue'
        };
      }
    } else if (lowerPrompt.includes('activity')) {
      return {
        chartType: 'bar',
        data: processActivitiesData(activities || []),
        xAxisKey: 'type',
        yAxisKey: 'count'
      };
    } else if (lowerPrompt.includes('account') || lowerPrompt.includes('industry')) {
      return {
        chartType: 'pie',
        data: processAccountsData(accounts || []),
        xAxisKey: 'industry',
        yAxisKey: 'count'
      };
    }

    // Default fallback
    return {
      chartType: 'bar',
      data: processDealsData(deals || []),
      xAxisKey: 'stage',
      yAxisKey: 'amount'
    };
  };

  const processContactsData = (contacts: any[]) => {
    if (!contacts) return [];
    
    const monthlyData = contacts.reduce((acc: any, contact) => {
      const date = new Date(contact.createdAt);
      const month = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(monthlyData).map(([month, count]) => ({
      month,
      contacts: count
    }));
  };

  const processDealsData = (deals: any[]) => {
    if (!deals || deals.length === 0) {
      // Return sample data if no deals exist
      return [
        { stage: 'PROSPECTING', amount: 25000 },
        { stage: 'QUALIFICATION', amount: 45000 },
        { stage: 'PROPOSAL', amount: 60000 },
        { stage: 'NEGOTIATION', amount: 35000 },
        { stage: 'CLOSED WON', amount: 80000 }
      ];
    }
    
    const stageData = deals.reduce((acc: any, deal) => {
      const stage = deal.stage || 'unknown';
      acc[stage] = (acc[stage] || 0) + (deal.amount || 0);
      return acc;
    }, {});

    const result = Object.entries(stageData).map(([stage, amount]) => ({
      stage: stage.replace('_', ' ').toUpperCase(),
      amount
    }));

    // Return sample data if no real data was processed
    return result.length > 0 ? result : [
      { stage: 'PROSPECTING', amount: 25000 },
      { stage: 'QUALIFICATION', amount: 45000 },
      { stage: 'PROPOSAL', amount: 60000 },
      { stage: 'NEGOTIATION', amount: 35000 },
      { stage: 'CLOSED WON', amount: 80000 }
    ];
  };

  const processRevenueData = (deals: any[]) => {
    if (!deals) return [];
    
    const monthlyRevenue = deals.reduce((acc: any, deal) => {
      if (deal.stage === 'closed_won' && deal.amount) {
        const date = new Date(deal.closeDate || deal.createdAt);
        const month = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        acc[month] = (acc[month] || 0) + deal.amount;
      }
      return acc;
    }, {});

    return Object.entries(monthlyRevenue).map(([month, revenue]) => ({
      month,
      revenue
    }));
  };

  const processConversionData = (contacts: any[]) => {
    if (!contacts) return [];
    
    const statusCounts = contacts.reduce((acc: any, contact) => {
      const status = contact.leadStatus || 'new';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count
    }));
  };

  const processActivitiesData = (activities: any[]) => {
    if (!activities) return [];
    
    const typeCounts = activities.reduce((acc: any, activity) => {
      const type = activity.activityType || 'other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(typeCounts).map(([type, count]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count
    }));
  };

  const processAccountsData = (accounts: any[]) => {
    if (!accounts) return [];
    
    const industryCounts = accounts.reduce((acc: any, account) => {
      const industry = account.industry || 'Other';
      acc[industry] = (acc[industry] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(industryCounts).map(([industry, count]) => ({
      industry,
      count
    }));
  };

  // Widget actions
  const handleCreateChart = (widgetId: string, prompt: string) => {
    setIsLoading(true);
    
    // Process the prompt and generate chart data
    const { data, chartType, xAxisKey, yAxisKey } = processDataFromPrompt(prompt);
    
    // Debug: Log the generated data
    console.log('Generated chart data:', { data, chartType, xAxisKey, yAxisKey, prompt });
    
    // Generate a title from the prompt
    const title = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt;
    
    setWidgets(prev => prev.map(widget => 
      widget.id === widgetId 
        ? { 
            ...widget, 
            title,
            prompt, 
            chartType,
            data,
            xAxisKey,
            yAxisKey,
            lastUpdated: new Date(),
            isActive: true
          }
        : widget
    ));
    
    setEditingWidget(null);
    setIsLoading(false);
  };

  const handleRefreshWidget = (widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (widget && widget.prompt) {
      const { data, chartType, xAxisKey, yAxisKey } = processDataFromPrompt(widget.prompt);
      setWidgets(prev => prev.map(w => 
        w.id === widgetId 
          ? { ...w, data, chartType, xAxisKey, yAxisKey, lastUpdated: new Date() }
          : w
      ));
    }
  };

  const handleExportWidget = (widget: ChartWidget) => {
    if (!widget.data.length) return;
    
    const chartData = widget.data;
    const chartConfig = {
      width: 600,
      height: 400,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
      xAxis: { dataKey: widget.xAxisKey },
      yAxis: { dataKey: widget.yAxisKey },
      chartType: widget.chartType
    };
    
    fetch('/api/export-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chartData,
        chartConfig,
        chartTitle: widget.title
      })
    })
    .then(response => response.json())
    .then(result => {
      if (result.spreadsheetUrl) {
        window.open(result.spreadsheetUrl, '_blank');
      } else if (result.error) {
        alert(`Export failed: ${result.message || result.error}`);
      }
    })
    .catch(error => {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    });
  };

  const handleClearWidget = (widgetId: string) => {
    setWidgets(prev => prev.map(widget => 
      widget.id === widgetId 
        ? { 
            ...widget, 
            title: '',
            prompt: '', 
            data: [],
            xAxisKey: 'stage',
            yAxisKey: 'amount',
            isActive: false
          }
        : widget
    ));
    setEditingWidget(null);
  };

  const handleFullscreenChart = (widget: ChartWidget) => {
    setFullscreenWidget(widget);
  };

  const handleCloseFullscreen = () => {
    setFullscreenWidget(null);
  };

  const handleAutoSave = () => {
    localStorage.setItem('analytics-widgets', JSON.stringify(widgets));
  };

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(handleAutoSave, 30000);
    return () => clearInterval(interval);
  }, [widgets]);

  if (!user) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Analytics Dashboard</h1>
          <p className="text-[#d9d2c7]">Please sign in to view analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl tracking-tight text-ink-900 mb-2">ANALYTICS DASHBOARD</h1>
          <p className="text-ink-700">Create custom charts from your CRM data</p>
          <div className="mt-4 bg-white px-4 py-2 rounded-ctl border border-line-200 shadow-card">
            <span className="text-sm text-ink-600">Auto-saving</span>
            <div className="w-2 h-2 bg-success-500 rounded-full ml-2 inline-block animate-pulse"></div>
          </div>
        </div>

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {widgets.map((widget) => (
            <Card 
              key={widget.id}
              title={widget.title || `Chart ${widget.id.split('-')[1]}`}
              toolbar={
                <div className="flex items-center space-x-2">
                  {widget.isActive && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshWidget(widget.id)}
                        className="h-8 w-8 p-0"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportWidget(widget)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingWidget(widget.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              }
            >
                {/* Widget Input */}
                {editingWidget === widget.id ? (
                  <div className="mb-6">
                    <Textarea
                      value={widget.prompt}
                      onChange={(e) => {
                        setWidgets(prev => prev.map(w => 
                          w.id === widget.id ? { ...w, prompt: e.target.value } : w
                        ));
                      }}
                      placeholder="Describe the chart you want to see (e.g., 'deals by stage', 'contact growth over time', 'revenue trends')..."
                      className="mb-4"
                      rows={3}
                    />
                    <div className="flex space-x-3">
                      <Button
                        variant="primary"
                        onClick={() => handleCreateChart(widget.id, widget.prompt)}
                        disabled={!widget.prompt.trim() || isLoading}
                      >
                        {isLoading ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        {widget.isActive ? 'Update' : 'Create'} Chart
                      </Button>
                      {widget.isActive && (
                        <Button
                          variant="subtle"
                          onClick={() => handleClearWidget(widget.id)}
                        >
                          Clear
                        </Button>
                      )}
                      <Button
                        variant="subtle"
                        onClick={() => setEditingWidget(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6">
                    <Input
                      value={widget.prompt}
                      onChange={(e) => {
                        setWidgets(prev => prev.map(w => 
                          w.id === widget.id ? { ...w, prompt: e.target.value } : w
                        ));
                      }}
                      className="mb-3"
                      placeholder="Enter a prompt to create a chart (e.g., 'deals by stage', 'contact growth over time')..."
                    />
                    {widget.prompt.trim() && (
                      <Button
                        variant="primary"
                        onClick={() => handleCreateChart(widget.id, widget.prompt)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Create Chart
                      </Button>
                    )}
                  </div>
                )}

                {/* Chart Display */}
                <div className="h-80 relative bg-bg-soft rounded-ctl border border-line-200 overflow-hidden chart-card">
                  {widget.isActive && widget.data.length > 0 ? (
                    <>
                      <div className="h-full w-full p-1">
                        <ChartDisplay
                          chartSpec={{
                            chartType: widget.chartType,
                            data: widget.data,
                            chartConfig: {
                              width: 360,
                              height: 240,
                              margin: { top: 8, right: 12, left: 8, bottom: 25 },
                              xAxis: { dataKey: widget.xAxisKey },
                              yAxis: { dataKey: widget.yAxisKey }
                            }
                          }}
                          narrative={widget.prompt}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFullscreenChart(widget)}
                        className="absolute top-3 right-3 bg-white/90 hover:bg-white text-ink-700 border border-line-200 h-8 w-8 p-0 shadow-card"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center text-ink-500">
                        <div className="mx-auto mb-3 h-8 w-8 text-accent-500">
                          <BarChart3 className="h-8 w-8" />
                        </div>
                        <p className="text-sm">
                          {widget.isActive ? 'No data available' : 'Click settings to create a chart'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
            </Card>
          ))}
        </div>



        {/* Fullscreen Modal */}
        {fullscreenWidget && (
          <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-card shadow-pop max-w-7xl w-full max-h-[95vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-line-200 bg-bg-soft">
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink-900">
                    {fullscreenWidget.title || `Chart ${fullscreenWidget.id.split('-')[1]}`}
                  </h2>
                  <p className="text-ink-600 mt-1">Full screen view</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="subtle"
                    onClick={() => handleExportWidget(fullscreenWidget)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button
                    variant="subtle"
                    onClick={handleCloseFullscreen}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-8 bg-white chart-card">
                <ChartDisplay
                  chartSpec={{
                    chartType: fullscreenWidget.chartType,
                    data: fullscreenWidget.data,
                    chartConfig: {
                      width: 900,
                      height: 600,
                      margin: { top: 30, right: 40, left: 30, bottom: 50 },
                      xAxis: { dataKey: fullscreenWidget.xAxisKey },
                      yAxis: { dataKey: fullscreenWidget.yAxisKey }
                    }
                  }}
                  narrative={fullscreenWidget.prompt}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
