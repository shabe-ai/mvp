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
  Settings
} from "lucide-react";

interface WidgetConfig {
  id: string;
  title: string;
  type: 'contacts' | 'deals' | 'accounts' | 'activities' | 'revenue' | 'conversion';
  chartType: 'bar' | 'line' | 'pie' | 'area';
  prompt: string;
  data: any[];
  lastUpdated: Date;
}

export default function AnalyticsPageClient() {
  const { user } = useUser();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [editingWidget, setEditingWidget] = useState<string | null>(null);

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

  // Initialize default widgets
  useEffect(() => {
    if (contacts && accounts && deals && activities) {
      const defaultWidgets: WidgetConfig[] = [
        {
          id: 'contacts-overview',
          title: 'Contact Growth',
          type: 'contacts',
          chartType: 'line',
          prompt: 'Show contact growth over time by month',
          data: processContactsData(contacts),
          lastUpdated: new Date()
        },
        {
          id: 'deals-pipeline',
          title: 'Deal Pipeline',
          type: 'deals',
          chartType: 'bar',
          prompt: 'Show deals by stage with amounts',
          data: processDealsData(deals),
          lastUpdated: new Date()
        },
        {
          id: 'revenue-trends',
          title: 'Revenue Trends',
          type: 'revenue',
          chartType: 'area',
          prompt: 'Show revenue trends over time',
          data: processRevenueData(deals),
          lastUpdated: new Date()
        },
        {
          id: 'lead-conversion',
          title: 'Lead Conversion',
          type: 'conversion',
          chartType: 'pie',
          prompt: 'Show lead conversion rates by status',
          data: processConversionData(contacts),
          lastUpdated: new Date()
        },
        {
          id: 'activity-overview',
          title: 'Activity Overview',
          type: 'activities',
          chartType: 'bar',
          prompt: 'Show activities by type and status',
          data: processActivitiesData(activities),
          lastUpdated: new Date()
        },
        {
          id: 'account-distribution',
          title: 'Account Distribution',
          type: 'accounts',
          chartType: 'pie',
          prompt: 'Show account distribution by industry',
          data: processAccountsData(accounts),
          lastUpdated: new Date()
        }
      ];
      setWidgets(defaultWidgets);
    }
  }, [contacts, accounts, deals, activities]);

  // Data processing functions
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
    if (!deals) return [];
    
    const stageData = deals.reduce((acc: any, deal) => {
      const stage = deal.stage || 'unknown';
      acc[stage] = (acc[stage] || 0) + (deal.amount || 0);
      return acc;
    }, {});

    return Object.entries(stageData).map(([stage, amount]) => ({
      stage: stage.replace('_', ' ').toUpperCase(),
      amount
    }));
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
  const handleRefreshWidget = (widgetId: string) => {
    setWidgets(prev => prev.map(widget => 
      widget.id === widgetId 
        ? { ...widget, lastUpdated: new Date() }
        : widget
    ));
  };

  const handleExportWidget = (widget: WidgetConfig) => {
    // Use existing Google Sheets export functionality
    const chartData = widget.data;
    const chartConfig = {
      width: 600,
      height: 400,
      margin: { top: 20, right: 30, left: 20, bottom: 5 }
    };
    
    // This will use the existing /api/export-sheets endpoint
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

  const handleUpdateWidget = (widgetId: string, newPrompt: string) => {
    // Here you would integrate with AI to generate new chart data based on the prompt
    // For now, we'll just update the prompt
    setWidgets(prev => prev.map(widget => 
      widget.id === widgetId 
        ? { ...widget, prompt: newPrompt, lastUpdated: new Date() }
        : widget
    ));
    setEditingWidget(null);
  };

  const handleAutoSave = () => {
    // Save widget configurations to localStorage or database
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
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black mb-3 uppercase tracking-wide">Analytics Dashboard</h1>
          <p className="text-[#d9d2c7] font-medium">Real-time insights from your CRM data</p>
        </div>

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {widgets.map((widget) => (
            <Card key={widget.id} className="bg-white border-[#d9d2c7] shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-black uppercase tracking-wide">
                    {widget.title}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRefreshWidget(widget.id)}
                      className="text-[#d9d2c7] hover:text-black"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleExportWidget(widget)}
                      className="text-[#d9d2c7] hover:text-black"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingWidget(widget.id)}
                      className="text-[#d9d2c7] hover:text-black"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-[#d9d2c7]">
                  Last updated: {widget.lastUpdated.toLocaleTimeString()}
                </p>
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
                      placeholder="Describe what you want to see in this widget..."
                      className="mb-2"
                      rows={2}
                    />
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateWidget(widget.id, widget.prompt)}
                        className="bg-[#f3e89a] hover:bg-[#f3e89a]/80 text-black"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Update
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingWidget(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4">
                    <Input
                      value={widget.prompt}
                      readOnly
                      className="text-sm text-[#d9d2c7] bg-[#f3e89a]/10"
                      placeholder="Click settings to customize this widget..."
                    />
                  </div>
                )}

                {/* Chart Display */}
                <div className="h-64">
                  <ChartDisplay
                    chartSpec={{
                      chartType: widget.chartType,
                      data: widget.data,
                      chartConfig: {
                        width: 400,
                        height: 250,
                        margin: { top: 20, right: 30, left: 20, bottom: 5 }
                      }
                    }}
                    narrative={widget.prompt}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Auto-save indicator */}
        <div className="fixed bottom-4 right-4">
          <div className="bg-[#f3e89a] text-black px-3 py-2 rounded-lg shadow-sm text-sm">
            Auto-saving...
          </div>
        </div>
      </div>
    </div>
  );
}
