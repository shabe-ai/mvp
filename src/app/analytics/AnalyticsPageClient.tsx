"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button, Input } from "@/components/shabe-ui";
import ChartDisplay from "@/components/ChartDisplay";
import { 
  RefreshCw,
  Download,
  BarChart3,
  Maximize2,
  X,
  Send} from "lucide-react";

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

  const [loadingWidgets, setLoadingWidgets] = useState<Set<string>>(new Set());
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

  // Initialize widgets from localStorage or create empty ones
  useEffect(() => {
    const savedWidgets = localStorage.getItem('analytics-widgets');
    if (savedWidgets) {
      try {
        const parsedWidgets = JSON.parse(savedWidgets);
        // Ensure lastUpdated is a Date object
        const hydratedWidgets = parsedWidgets.map((w: ChartWidget) => ({
          ...w,
          lastUpdated: new Date(w.lastUpdated)
        }));
        setWidgets(hydratedWidgets);
      } catch (error) {
        console.error('Error parsing saved widgets:', error);
        // Fallback to empty widgets if parsing fails
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
      }
    } else {
      // Create empty widgets if no saved data
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
    }
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
      if (lowerPrompt.includes('grouped by account') || lowerPrompt.includes('by account')) {
        return {
          chartType: 'bar',
          data: processContactsByAccountData(contacts || []),
          xAxisKey: 'account',
          yAxisKey: 'count'
        };
      } else if (lowerPrompt.includes('growth') || lowerPrompt.includes('over time')) {
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
      if (lowerPrompt.includes('count')) {
        return {
          chartType: 'bar',
          data: processDealsCountData(deals || []),
          xAxisKey: 'stage',
          yAxisKey: 'count'
        };
      } else if (lowerPrompt.includes('stage')) {
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
      // Check if user wants activities grouped by contacts
      if (lowerPrompt.includes('grouped by contact') || lowerPrompt.includes('by contact')) {
        return {
          chartType: 'bar',
          data: processActivitiesByContactData(activities || [], contacts || []),
          xAxisKey: 'contact',
          yAxisKey: 'count'
        };
      } else {
        return {
          chartType: 'bar',
          data: processActivitiesData(activities || []),
          xAxisKey: 'type',
          yAxisKey: 'count'
        };
      }
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

  const processDealsCountData = (deals: any[]) => {
    if (!deals || deals.length === 0) {
      // Return sample data if no deals exist
      return [
        { stage: 'PROSPECTING', count: 5 },
        { stage: 'QUALIFICATION', count: 8 },
        { stage: 'PROPOSAL', count: 12 },
        { stage: 'NEGOTIATION', count: 6 },
        { stage: 'CLOSED WON', count: 15 }
      ];
    }
    
    const stageData = deals.reduce((acc: any, deal) => {
      const stage = deal.stage || 'unknown';
      acc[stage] = (acc[stage] || 0) + 1; // Count deals instead of summing amounts
      return acc;
    }, {});

    const result = Object.entries(stageData).map(([stage, count]) => ({
      stage: stage.replace('_', ' ').toUpperCase(),
      count
    }));

    // Return sample data if no real data was processed
    return result.length > 0 ? result : [
      { stage: 'PROSPECTING', count: 5 },
      { stage: 'QUALIFICATION', count: 8 },
      { stage: 'PROPOSAL', count: 12 },
      { stage: 'NEGOTIATION', count: 6 },
      { stage: 'CLOSED WON', count: 15 }
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

  const processContactsByAccountData = (contacts: any[]) => {
    if (!contacts || contacts.length === 0) {
      // Return sample data if no contacts exist
      return [
        { account: 'Acme Corp', count: 8 },
        { account: 'Tech Solutions', count: 12 },
        { account: 'Global Industries', count: 5 },
        { account: 'Startup Inc', count: 15 },
        { account: 'Enterprise Ltd', count: 7 }
      ];
    }
    
    const accountCounts = contacts.reduce((acc: any, contact) => {
      const accountName = contact.accountName || contact.account?.name || 'Unknown Account';
      acc[accountName] = (acc[accountName] || 0) + 1;
      return acc;
    }, {});

    const result = Object.entries(accountCounts).map(([account, count]) => ({
      account: account.replace('_', ' ').toUpperCase(),
      count
    }));

    // Return sample data if no real data was processed
    return result.length > 0 ? result : [
      { account: 'ACME CORP', count: 8 },
      { account: 'TECH SOLUTIONS', count: 12 },
      { account: 'GLOBAL INDUSTRIES', count: 5 },
      { account: 'STARTUP INC', count: 15 },
      { account: 'ENTERPRISE LTD', count: 7 }
    ];
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

  const processActivitiesByContactData = (activities: any[], contacts: any[]) => {
    if (!activities || !contacts) return [];
    
    console.log('🔍 Processing activities by contact data:', {
      activitiesCount: activities.length,
      contactsCount: contacts.length,
      sampleActivity: activities[0],
      sampleContact: contacts[0]
    });
    
    // Create a map of contact IDs to contact names
    const contactMap = new Map();
    contacts.forEach(contact => {
      contactMap.set(contact._id, `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown Contact');
    });
    
    // Group activities by contact
    const contactGroups: Record<string, number> = {};
    activities.forEach(activity => {
      const contactId = activity.contactId || 'unknown';
      const contactName = contactMap.get(contactId) || 'Unknown Contact';
      contactGroups[contactName] = (contactGroups[contactName] || 0) + 1;
    });
    
    const result = Object.entries(contactGroups).map(([contactName, count]) => ({
      contact: contactName,
      count,
      name: contactName
    }));
    
    console.log('🔍 Activities by contact result:', result);
    
    return result;
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
  const handleCreateChart = async (widgetId: string, prompt?: string) => {
    setLoadingWidgets(prev => new Set(prev).add(widgetId));
    
    try {
      // Get the current widget to ensure we have the latest prompt
      const currentWidget = widgets.find(w => w.id === widgetId);
      const currentPrompt = prompt || currentWidget?.prompt || '';
      
      if (!currentPrompt.trim()) {
        setLoadingWidgets(prev => {
          const newSet = new Set(prev);
          newSet.delete(widgetId);
          return newSet;
        });
        return;
      }

      // Use the existing AI system via /api/chat
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Create a chart: ${currentPrompt}`
            }
          ],
          userId: user?.id,
          sessionFiles: [],
          companyData: {},
          userData: {
            name: user?.fullName || 'User',
            email: user?.primaryEmailAddress?.emailAddress || 'user@example.com',
            company: 'Shabe AI'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate chart');
      }

      const result = await response.json();
      
      // Extract chart specification from the AI response
      let chartSpec = result.chartSpec;
      
      // If no chartSpec in response, try to parse from message
      if (!chartSpec && result.message) {
        try {
          // Look for JSON in the message
          const jsonMatch = result.message.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            chartSpec = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          console.error('Failed to parse chart spec from message:', parseError);
        }
      }

      // Fallback to rigid system if AI fails
      if (!chartSpec) {
        const { data, chartType, xAxisKey, yAxisKey } = processDataFromPrompt(currentPrompt);
        chartSpec = { data, chartType, xAxisKey, yAxisKey };
        console.log('🔍 Using fallback chart spec:', { data, chartType, xAxisKey, yAxisKey });
      } else {
        console.log('🔍 Using AI chart spec:', chartSpec);
      }

      // Generate a title from the prompt or AI response
      const title = result.title || 
                   (currentPrompt.length > 30 ? currentPrompt.substring(0, 30) + '...' : currentPrompt);
      
      const updatedWidgets = widgets.map(widget => 
        widget.id === widgetId 
          ? { 
              ...widget, 
              title,
              prompt: currentPrompt, 
              chartType: chartSpec.chartType || 'bar',
              data: chartSpec.data || [],
              xAxisKey: chartSpec.xAxisKey || 'name',
              yAxisKey: chartSpec.yAxisKey || 'value',
              lastUpdated: new Date(),
              isActive: true
            }
          : widget
      );
      
      setWidgets(updatedWidgets);
      
      // Auto-save immediately after creating chart
      localStorage.setItem('analytics-widgets', JSON.stringify(updatedWidgets));
      
    } catch (error) {
      console.error('Chart generation error:', error);
      
      // Fallback to rigid system on error
      const currentWidget = widgets.find(w => w.id === widgetId);
      const currentPrompt = prompt || currentWidget?.prompt || '';
      const { data, chartType, xAxisKey, yAxisKey } = processDataFromPrompt(currentPrompt);
      
      const title = currentPrompt.length > 30 ? currentPrompt.substring(0, 30) + '...' : currentPrompt;
      
      const updatedWidgets = widgets.map(widget => 
        widget.id === widgetId 
          ? { 
              ...widget, 
              title,
              prompt: currentPrompt, 
              chartType,
              data,
              xAxisKey,
              yAxisKey,
              lastUpdated: new Date(),
              isActive: true
            }
          : widget
      );
      
      setWidgets(updatedWidgets);
      localStorage.setItem('analytics-widgets', JSON.stringify(updatedWidgets));
    }
    
    setLoadingWidgets(prev => {
      const newSet = new Set(prev);
      newSet.delete(widgetId);
      return newSet;
    });
  };

  const handleRefreshWidget = async (widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (widget && widget.prompt) {
      try {
        // Use the existing AI system via /api/chat for refresh
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: `Create a chart: ${widget.prompt}`
              }
            ],
            userId: user?.id,
            sessionFiles: [],
            companyData: {},
            userData: {
              name: user?.fullName || 'User',
              email: user?.primaryEmailAddress?.emailAddress || 'user@example.com',
              company: 'Shabe AI'
            }
          })
        });

        if (response.ok) {
          const result = await response.json();
          let chartSpec = result.chartSpec;
          
          // If no chartSpec in response, try to parse from message
          if (!chartSpec && result.message) {
            try {
              const jsonMatch = result.message.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                chartSpec = JSON.parse(jsonMatch[0]);
              }
            } catch (parseError) {
              console.error('Failed to parse chart spec from message:', parseError);
            }
          }

          // Fallback to rigid system if AI fails
          if (!chartSpec) {
            const { data, chartType, xAxisKey, yAxisKey } = processDataFromPrompt(widget.prompt);
            chartSpec = { data, chartType, xAxisKey, yAxisKey };
          }

          const updatedWidgets = widgets.map(w => 
            w.id === widgetId 
              ? { 
                  ...w, 
                  chartType: chartSpec.chartType || 'bar',
                  data: chartSpec.data || [],
                  xAxisKey: chartSpec.xAxisKey || 'name',
                  yAxisKey: chartSpec.yAxisKey || 'value',
                  lastUpdated: new Date() 
                }
              : w
          );
          setWidgets(updatedWidgets);
          localStorage.setItem('analytics-widgets', JSON.stringify(updatedWidgets));
        } else {
          throw new Error('Failed to refresh chart');
        }
      } catch (error) {
        console.error('Refresh error:', error);
        
        // Fallback to rigid system on error
        const { data, chartType, xAxisKey, yAxisKey } = processDataFromPrompt(widget.prompt);
        const updatedWidgets = widgets.map(w => 
          w.id === widgetId 
            ? { ...w, data, chartType, xAxisKey, yAxisKey, lastUpdated: new Date() }
            : w
        );
        setWidgets(updatedWidgets);
        localStorage.setItem('analytics-widgets', JSON.stringify(updatedWidgets));
      }
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



  const handleFullscreenChart = (widget: ChartWidget) => {
    setFullscreenWidget(widget);
  };

  const handleCloseFullscreen = () => {
    setFullscreenWidget(null);
  };

  const handleAutoSave = () => {
    localStorage.setItem('analytics-widgets', JSON.stringify(widgets));
  };

  // Auto-save whenever widgets change (but not on initial load)
  useEffect(() => {
    if (widgets.length > 0) {
      handleAutoSave();
    }
  }, [widgets]);

  // Also auto-save every 30 seconds as backup
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
    <div className="min-h-screen bg-bg w-full">
      <div className="w-full bg-bg flex flex-col p-0 m-0">
        {/* Header */}
        <div className="text-center py-8 w-full max-w-4xl mx-auto px-6">
          <h1 className="font-display text-3xl font-bold text-ink-900 mb-4">
            Analytics Dashboard
          </h1>
          <p className="text-lg text-ink-700">
            Create custom charts from your CRM data
          </p>
        </div>

        {/* Content Area */}
        <div className="w-full max-w-7xl mx-auto px-6 pb-8">
          {/* Widgets Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
          {widgets.map((widget) => (
            <div key={widget.id} className="bg-white rounded-card shadow-card p-4 sm:p-6 space-y-3 sm:space-y-4">
              {/* Widget Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-ink-900">
                  {widget.title || `Chart ${widget.id.split('-')[1]}`}
                </h3>
                <div className="flex items-center space-x-2">
                  {widget.isActive && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshWidget(widget.id)}
                        className="h-8 w-8 p-0 text-ink-500 hover:text-ink-700"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportWidget(widget)}
                        className="h-8 w-8 p-0 text-ink-500 hover:text-ink-700"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Chart Display */}
              <div className="h-64 sm:h-72 md:h-80 lg:h-96 relative bg-bg-soft rounded-ctl border border-line-200 overflow-hidden">
                {widget.isActive && widget.data.length > 0 ? (
                  <>
                    <div className="h-full w-full p-2 sm:p-4">
                      <ChartDisplay
                        key={`${widget.id}-${widget.lastUpdated instanceof Date ? widget.lastUpdated.getTime() : new Date(widget.lastUpdated).getTime()}`}
                        chartSpec={{
                          chartType: widget.chartType,
                          data: widget.data,
                          chartConfig: {
                            width: 400,
                            height: 200,
                            margin: { top: 20, right: 20, left: 20, bottom: 30 },
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
                        {widget.isActive ? 'No data available' : 'Enter prompt below to create chart'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Section */}
              <div className="flex space-x-3">
                <Input
                  value={widget.prompt}
                  onChange={(e) => {
                    setWidgets(prev => prev.map(w => 
                      w.id === widget.id ? { ...w, prompt: e.target.value } : w
                    ));
                  }}
                  className="flex-1"
                  placeholder="Enter a prompt to create a chart (e.g., 'deals by stage')..."
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleCreateChart(widget.id)}
                  disabled={loadingWidgets.has(widget.id) || !widget.prompt.trim()}
                  className="h-10 w-10 p-0 flex-shrink-0"
                >
                  {loadingWidgets.has(widget.id) ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
        {fullscreenWidget && (
          <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-card shadow-pop max-w-7xl w-full max-h-[95vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-line-200 bg-bg-soft">
                <div>
                  <h2 className="font-display text-xl font-bold text-ink-900">
                    {fullscreenWidget.title || `Chart ${fullscreenWidget.id.split('-')[1]}`}
                  </h2>
                  <p className="text-ink-600 text-sm">Full screen view</p>
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
              <div className="p-6 bg-white chart-card">
                <ChartDisplay
                  key={`fullscreen-${fullscreenWidget.id}-${fullscreenWidget.lastUpdated instanceof Date ? fullscreenWidget.lastUpdated.getTime() : new Date(fullscreenWidget.lastUpdated).getTime()}`}
                  chartSpec={{
                    chartType: fullscreenWidget.chartType,
                    data: fullscreenWidget.data,
                    chartConfig: {
                      width: 800,
                      height: 500,
                      margin: { top: 20, right: 30, left: 20, bottom: 40 },
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
  );
}
