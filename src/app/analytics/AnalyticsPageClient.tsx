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
      margin: { top: 20, right: 30, left: 20, bottom: 5 }
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
      }
    })
    .catch(error => console.error('Export failed:', error));
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
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-black mb-1 uppercase tracking-wide">Analytics Dashboard</h1>
          <p className="text-sm text-[#d9d2c7]">Create custom charts from your CRM data</p>
        </div>

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {widgets.map((widget) => (
            <Card key={widget.id} className="bg-white border-[#d9d2c7] shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-black uppercase tracking-wide">
                    {widget.title || `Chart ${widget.id.split('-')[1]}`}
                  </CardTitle>
                  <div className="flex items-center space-x-1">
                    {widget.isActive && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRefreshWidget(widget.id)}
                          className="text-[#d9d2c7] hover:text-black h-6 w-6 p-0"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExportWidget(widget)}
                          className="text-[#d9d2c7] hover:text-black h-6 w-6 p-0"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingWidget(widget.id)}
                      className="text-[#d9d2c7] hover:text-black h-6 w-6 p-0"
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {widget.isActive && (
                  <p className="text-xs text-[#d9d2c7] text-xs">
                    Last updated: {widget.lastUpdated.toLocaleTimeString()}
                  </p>
                )}
              </CardHeader>
              
              <CardContent>
                {/* Widget Input */}
                {editingWidget === widget.id ? (
                  <div className="mb-4">
                    <Textarea
                      value={widget.prompt}
                      onChange={(e) => {
                        setWidgets(prev => prev.map(w => 
                          w.id === widget.id ? { ...w, prompt: e.target.value } : w
                        ));
                      }}
                      placeholder="Describe the chart you want to see (e.g., 'deals by stage', 'contact growth over time', 'revenue trends')..."
                      className="mb-2 text-sm"
                      rows={2}
                    />
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        onClick={() => handleCreateChart(widget.id, widget.prompt)}
                        disabled={!widget.prompt.trim() || isLoading}
                        className="bg-[#f3e89a] hover:bg-[#f3e89a]/80 text-black text-xs h-8"
                      >
                        {isLoading ? (
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3 mr-1" />
                        )}
                        {widget.isActive ? 'Update' : 'Create'} Chart
                      </Button>
                      {widget.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleClearWidget(widget.id)}
                          className="text-xs h-8"
                        >
                          Clear
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingWidget(null)}
                        className="text-xs h-8"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3">
                    <Input
                      value={widget.prompt}
                      onChange={(e) => {
                        setWidgets(prev => prev.map(w => 
                          w.id === widget.id ? { ...w, prompt: e.target.value } : w
                        ));
                      }}
                      className="text-xs text-black bg-white border-[#d9d2c7] mb-2 h-8"
                      placeholder="Enter a prompt to create a chart (e.g., 'deals by stage', 'contact growth over time')..."
                    />
                    {widget.prompt.trim() && (
                      <Button
                        size="sm"
                        onClick={() => handleCreateChart(widget.id, widget.prompt)}
                        disabled={isLoading}
                        className="bg-[#f3e89a] hover:bg-[#f3e89a]/80 text-black text-xs h-8"
                      >
                        {isLoading ? (
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3 mr-1" />
                        )}
                        Create Chart
                      </Button>
                    )}
                  </div>
                )}

                {/* Chart Display */}
                <div className="h-64 relative overflow-hidden">
                  {widget.isActive && widget.data.length > 0 ? (
                    <div className="h-full w-full">
                      <div className="w-full h-full flex items-center justify-center overflow-hidden">
                        <ChartDisplay
                          chartSpec={{
                            chartType: widget.chartType,
                            data: widget.data,
                            chartConfig: {
                              width: 260,
                              height: 160,
                              margin: { top: 10, right: 15, left: 10, bottom: 20 },
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
                        className="absolute top-1 right-1 bg-white/80 hover:bg-white text-black border border-gray-200 h-6 w-6 p-0"
                      >
                        <Maximize2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center border-2 border-dashed border-[#d9d2c7] rounded-lg">
                      <div className="text-center">
                        <BarChart3 className="h-12 w-12 text-[#d9d2c7] mx-auto mb-2" />
                        <p className="text-sm text-[#d9d2c7]">
                          {widget.isActive ? 'No data available' : 'Click settings to create a chart'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Auto-save indicator */}
        <div className="fixed bottom-2 right-2">
          <div className="bg-[#f3e89a] text-black px-2 py-1 rounded text-xs">
            Auto-saving...
          </div>
        </div>

        {/* Fullscreen Modal */}
        {fullscreenWidget && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-black">
                  {fullscreenWidget.title || `Chart ${fullscreenWidget.id.split('-')[1]}`}
                </h2>
                <div className="flex items-center space-x-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleExportWidget(fullscreenWidget)}
                    className="text-[#d9d2c7] hover:text-black"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCloseFullscreen}
                    className="text-[#d9d2c7] hover:text-black"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-6">
                <ChartDisplay
                  chartSpec={{
                    chartType: fullscreenWidget.chartType,
                    data: fullscreenWidget.data,
                    chartConfig: {
                      width: 800,
                      height: 500,
                      margin: { top: 20, right: 30, left: 20, bottom: 25 },
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
