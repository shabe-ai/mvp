'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Lightbulb, 
  Settings,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

interface PersonalizedDashboardProps {
  userId: string;
}

interface Widget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'insight';
  title: string;
  data: any;
  position: { x: number; y: number; width: number; height: number };
  refreshInterval: number;
}

interface PersonalizedInsight {
  insight: string;
  relevance: number;
  actionability: number;
  category: 'sales' | 'marketing' | 'customer' | 'product' | 'general';
  suggestedActions: string[];
  timestamp: Date;
}

interface AdaptiveUI {
  preferredView: 'table' | 'chart' | 'list';
  quickActions: string[];
  shortcuts: Record<string, string>;
  interfacePreferences: {
    compactMode: boolean;
    showSuggestions: boolean;
    autoRefresh: boolean;
    notificationLevel: 'high' | 'medium' | 'low';
  };
}

export default function PersonalizedDashboard({ userId }: PersonalizedDashboardProps) {
  const [dashboard, setDashboard] = useState<{ widgets: Widget[] } | null>(null);
  const [insights, setInsights] = useState<PersonalizedInsight[]>([]);
  const [adaptiveUI, setAdaptiveUI] = useState<AdaptiveUI | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, [userId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      
      // Load dashboard
      const dashboardResponse = await fetch('/api/personalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_dashboard' })
      });
      const dashboardData = await dashboardResponse.json();
      setDashboard(dashboardData.dashboard);

      // Load insights
      const insightsResponse = await fetch('/api/personalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_insights' })
      });
      const insightsData = await insightsResponse.json();
      setInsights(insightsData.insights);

      // Load adaptive UI
      const uiResponse = await fetch('/api/personalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'adapt_ui' })
      });
      const uiData = await uiResponse.json();
      setAdaptiveUI(uiData.adaptiveUI);

      // Load recommendations
      const recResponse = await fetch('/api/personalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_recommendations' })
      });
      const recData = await recResponse.json();
      setRecommendations(recData.recommendations);

    } catch (error) {
      console.error('Error loading personalized dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const trackInteraction = async (action: string, metadata?: any) => {
    try {
      await fetch('/api/personalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_interaction',
          data: { action, metadata }
        })
      });
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  };

  const renderWidget = (widget: Widget) => {
    const baseClasses = `p-4 ${compactMode ? 'text-sm' : 'text-base'}`;
    
    switch (widget.type) {
      case 'metric':
        return (
          <Card key={widget.id} className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent className={baseClasses}>
              <div className="text-3xl font-bold">
                {widget.data.metrics?.includes('total_contacts') && '1,234'}
                {widget.data.metrics?.includes('total_deals') && '567'}
                {widget.data.metrics?.includes('revenue') && '$89,012'}
              </div>
              <p className="text-muted-foreground mt-2">
                {widget.data.metrics?.includes('total_contacts') && 'Total contacts in your CRM'}
                {widget.data.metrics?.includes('total_deals') && 'Active deals in pipeline'}
                {widget.data.metrics?.includes('revenue') && 'Total revenue this month'}
              </p>
            </CardContent>
          </Card>
        );

      case 'chart':
        return (
          <Card key={widget.id} className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent className={baseClasses}>
              <div className="h-48 flex items-center justify-center bg-muted/20 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Chart visualization</p>
                  <p className="text-sm text-muted-foreground">
                    {widget.data.chartType} chart for {widget.data.dataType}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'table':
        return (
          <Card key={widget.id} className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent className={baseClasses}>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-muted/20 rounded">
                    <span>Sample {widget.data.dataType} {i}</span>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case 'insight':
        return (
          <Card key={widget.id} className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent className={baseClasses}>
              <div className="space-y-3">
                {widget.data.insights?.slice(0, 3).map((insight: any, index: number) => (
                  <div key={index} className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <p className="text-sm font-medium mb-1">{insight.insight}</p>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        {insight.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {insight.relevance}% relevant
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  const renderInsights = () => (
    <div className="space-y-4">
      {insights.map((insight, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              {insight.category.charAt(0).toUpperCase() + insight.category.slice(1)} Insight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3">{insight.insight}</p>
            <div className="flex gap-2 mb-3">
              <Badge variant="outline">Relevance: {insight.relevance}%</Badge>
              <Badge variant="outline">Actionability: {insight.actionability}%</Badge>
              <Badge variant="secondary">{insight.category}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Suggested Actions:</p>
              {insight.suggestedActions.map((action, actionIndex) => (
                <p key={actionIndex} className="text-sm">• {action}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderRecommendations = () => (
    <div className="space-y-3">
      {recommendations.map((recommendation, index) => (
        <Card key={index}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 mt-0.5 text-blue-500" />
              <p className="text-sm">{recommendation}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderAdaptiveUI = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Interface Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Preferred View:</p>
            <Badge variant="outline">{adaptiveUI?.preferredView}</Badge>
          </div>
          
          <div>
            <p className="text-sm font-medium mb-2">Quick Actions:</p>
            <div className="flex flex-wrap gap-2">
              {adaptiveUI?.quickActions.map((action, index) => (
                <Badge key={index} variant="secondary">{action}</Badge>
              ))}
            </div>
          </div>
          
          <div>
            <p className="text-sm font-medium mb-2">Keyboard Shortcuts:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(adaptiveUI?.shortcuts || {}).map(([shortcut, action]) => (
                <div key={shortcut} className="flex justify-between">
                  <code className="bg-muted px-2 py-1 rounded">{shortcut}</code>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <p className="text-sm font-medium mb-2">Interface Settings:</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Compact Mode</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCompactMode(!compactMode)}
                >
                  {compactMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Show Suggestions</span>
                <Badge variant={adaptiveUI?.interfacePreferences.showSuggestions ? 'default' : 'secondary'}>
                  {adaptiveUI?.interfacePreferences.showSuggestions ? 'On' : 'Off'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Auto Refresh</span>
                <Badge variant={adaptiveUI?.interfacePreferences.autoRefresh ? 'default' : 'secondary'}>
                  {adaptiveUI?.interfacePreferences.autoRefresh ? 'On' : 'Off'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Notification Level</span>
                <Badge variant="outline">{adaptiveUI?.interfacePreferences.notificationLevel}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading your personalized dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Your Personalized Dashboard</h2>
          <p className="text-muted-foreground">
            Tailored insights and recommendations based on your usage patterns
          </p>
        </div>
        <Button onClick={loadDashboard} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {dashboard?.widgets && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboard.widgets.map((widget) => (
                <div
                  key={widget.id}
                  className={`col-span-${widget.position.width} row-span-${widget.position.height}`}
                  onClick={() => trackInteraction('widget_click', { widgetId: widget.id })}
                >
                  {renderWidget(widget)}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          {renderInsights()}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          {renderRecommendations()}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          {renderAdaptiveUI()}
        </TabsContent>
      </Tabs>
    </div>
  );
} 