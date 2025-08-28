"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
              <p className="text-gray-600">Create custom charts from your CRM data</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
                <span className="text-sm text-gray-600">Auto-saving</span>
                <div className="w-2 h-2 bg-green-500 rounded-full ml-2 inline-block animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {widgets.map((widget) => (
            <Card key={widget.id} className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
                      {widget.title || `Chart ${widget.id.split('-')[1]}`}
                    </CardTitle>
                    {widget.isActive && (
                      <p className="text-sm text-gray-500">
                        Last updated: {widget.lastUpdated.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {widget.isActive && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRefreshWidget(widget.id)}
                          className="text-gray-500 hover:text-gray-700 h-8 w-8 p-0"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExportWidget(widget)}
                          className="text-gray-500 hover:text-gray-700 h-8 w-8 p-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingWidget(widget.id)}
                      className="text-gray-500 hover:text-gray-700 h-8 w-8 p-0"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
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
                      className="mb-4 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      rows={3}
                    />
                    <div className="flex space-x-3">
                      <Button
                        size="sm"
                        onClick={() => handleCreateChart(widget.id, widget.prompt)}
                        disabled={!widget.prompt.trim() || isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
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
                          size="sm"
                          variant="outline"
                          onClick={() => handleClearWidget(widget.id)}
                          className="border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2"
                        >
                          Clear
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingWidget(null)}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2"
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
                      className="text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 mb-3"
                      placeholder="Enter a prompt to create a chart (e.g., 'deals by stage', 'contact growth over time')..."
                    />
                    {widget.prompt.trim() && (
                      <Button
                        size="sm"
                        onClick={() => handleCreateChart(widget.id, widget.prompt)}
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
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
                <div className="h-80 relative bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
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
                        size="sm"
                        variant="ghost"
                        onClick={() => handleFullscreenChart(widget)}
                        className="absolute top-3 right-3 bg-white/90 hover:bg-white text-gray-700 border border-gray-300 h-8 w-8 p-0 shadow-sm"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                          <BarChart3 className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium mb-1">
                          {widget.isActive ? 'No data available' : 'Create your first chart'}
                        </p>
                        <p className="text-sm text-gray-400">
                          {widget.isActive ? 'Try refreshing the data' : 'Click settings to get started'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>



        {/* Fullscreen Modal */}
        {fullscreenWidget && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {fullscreenWidget.title || `Chart ${fullscreenWidget.id.split('-')[1]}`}
                  </h2>
                  <p className="text-gray-600 mt-1">Full screen view</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportWidget(fullscreenWidget)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCloseFullscreen}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-8 bg-white">
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
