"use client";

import React, { useState, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ScatterChart, Scatter,
  ComposedChart
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, 
  Share2, 
  Settings, 
  BarChart3, 
  TrendingUp, 
  PieChart as PieChartIcon,
  ScatterChart as ScatterChartIcon,
  AreaChart as AreaChartIcon,
  LineChart as LineChartIcon,
  RotateCcw,
  CheckCircle,
  DollarSign,
  Users,
  Activity,
  Eye,
  Brain,
  TrendingDown,
  Target,
  Zap
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface ChartSpec {
  chartType: string;
  data: any[];
  chartConfig: {
    width: number;
    height: number;
    margin?: { top: number; right: number; bottom: number; left: number };
    xAxis?: any;
    yAxis?: any;
  };
}

interface EnhancedChartDisplayProps {
  chartSpec: ChartSpec;
  narrative?: string;
  onUpdate?: (newConfig: any) => void;
  onExport?: (format: string) => void;
  onGoogleSheetsExport?: (chartData: any[], chartConfig: any, chartTitle: string) => void;
  onShare?: () => void;
  onInsightAction?: (insight: string) => void;
  isInteractive?: boolean;
}

interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral' | 'opportunity';
  confidence: number;
  action?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function EnhancedChartDisplay({ 
  chartSpec, 
  narrative, 
  onUpdate,
  onExport,
  onGoogleSheetsExport,
  onShare,
  onInsightAction,
  isInteractive = true
}: EnhancedChartDisplayProps) {
  const [activeTab, setActiveTab] = useState('chart');
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);

  logger.debug('EnhancedChartDisplay received', { 
    chartType: chartSpec.chartType,
    dataLength: chartSpec.data?.length,
    isInteractive,
    userId: 'client-side'
  });

  // Validate and normalize data
  const { data, chartType, chartConfig } = useMemo(() => {
    if (!chartSpec.data || !Array.isArray(chartSpec.data) || chartSpec.data.length === 0) {
      logger.error('Invalid or empty data array', undefined, { 
        dataType: typeof chartSpec.data,
        dataLength: chartSpec.data?.length,
        userId: 'client-side'
      });
      return { data: [], chartType: 'bar', chartConfig: chartSpec.chartConfig };
    }

    logger.debug('EnhancedChartDisplay processing', {
      originalChartType: chartSpec.chartType,
      dataLength: chartSpec.data.length,
      chartConfig: JSON.stringify(chartSpec.chartConfig),
      userId: 'client-side'
    });

    // Normalize chart type
    const normalizedChartType = chartSpec.chartType.toLowerCase();
    
    return {
      data: chartSpec.data,
      chartType: normalizedChartType,
      chartConfig: chartSpec.chartConfig
    };
  }, [chartSpec]);

  // Generate insights based on data
  const insights = useMemo(() => {
    if (!data || data.length === 0) return [];

    const insights: Insight[] = [];
    
    try {
      // Basic statistical insights
      const numericColumns = Object.keys(data[0]).filter(key => 
        typeof data[0][key] === 'number' && key !== 'id'
      );

      numericColumns.forEach(column => {
        const values = data.map(item => item[column]).filter(val => typeof val === 'number');
        if (values.length === 0) return;

        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        const trend = values[values.length - 1] - values[0];

        // Generate insights based on patterns
        if (trend > 0) {
          insights.push({
            id: `trend-${column}`,
            title: `Positive Trend in ${column}`,
            description: `${column} shows an upward trend of ${trend.toFixed(2)} units`,
            type: 'positive',
            confidence: 0.8
          });
        } else if (trend < 0) {
          insights.push({
            id: `trend-${column}`,
            title: `Declining Trend in ${column}`,
            description: `${column} shows a downward trend of ${Math.abs(trend).toFixed(2)} units`,
            type: 'negative',
            confidence: 0.8
          });
        }

        if (max > avg * 1.5) {
          insights.push({
            id: `outlier-${column}`,
            title: `High Value in ${column}`,
            description: `Maximum value of ${max} is significantly above average of ${avg.toFixed(2)}`,
            type: 'opportunity',
            confidence: 0.7
          });
        }
      });

      // Distribution insights for categorical data
      const categoricalColumns = Object.keys(data[0]).filter(key => 
        typeof data[0][key] === 'string' && key !== 'id'
      );

      categoricalColumns.forEach(column => {
        const valueCounts: Record<string, number> = {};
        data.forEach(item => {
          const value = item[column];
          valueCounts[value] = (valueCounts[value] || 0) + 1;
        });

        const entries = Object.entries(valueCounts);
        if (entries.length > 1) {
          const [mostCommon, mostCommonCount] = entries.reduce((a, b) => a[1] > b[1] ? a : b);
          const total = data.length;
          const percentage = (mostCommonCount / total) * 100;

          if (percentage > 50) {
            insights.push({
              id: `distribution-${column}`,
              title: `Concentration in ${column}`,
              description: `${mostCommon} represents ${percentage.toFixed(1)}% of all ${column} values`,
              type: 'neutral',
              confidence: 0.9
            });
          }
        }
      });

    } catch (error) {
      logger.error('Error generating insights', error instanceof Error ? error : new Error(String(error)), {
        dataLength: data.length,
        userId: 'client-side'
      });
    }

    return insights.slice(0, 6); // Limit to 6 insights
  }, [data]);

  const handleExport = useCallback((format: string) => {
    logger.info(`Exporting chart as ${format}`, { 
      chartType,
      dataLength: data.length,
      userId: 'client-side'
    });
    
    if (onExport) {
      onExport(format);
    }
  }, [chartType, data.length, onExport]);

  const handleShare = useCallback(() => {
    logger.info('Sharing chart', { 
      chartType,
      dataLength: data.length,
      userId: 'client-side'
    });
    
    if (onShare) {
      onShare();
    }
  }, [chartType, data.length, onShare]);

  const handleInsightAction = useCallback((insight: Insight) => {
    logger.info('Insight action triggered', { 
      insightId: insight.id,
      insightTitle: insight.title,
      userId: 'client-side'
    });
    
    if (onInsightAction) {
      onInsightAction(insight.title);
    }
  }, [onInsightAction]);

  const renderChart = () => {
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No data available for chart
        </div>
      );
    }

    logger.debug('EnhancedChartDisplay rendering with', {
      chartType,
      dataLength: data.length,
      dataKeys: Object.keys(data[0] || {}),
      chartConfig: JSON.stringify(chartConfig),
      userId: 'client-side'
    });

    const dataKeys = Object.keys(data[0] || {}).filter(key => key !== 'id');
    logger.debug('Available data keys', { 
      dataKeys,
      userId: 'client-side'
    });

    const xAxisDataKey = dataKeys[0] || 'name';
    const yAxisDataKey = dataKeys[1] || dataKeys[0];

    switch (chartType) {
      case 'bar':
        const barDataKeys = dataKeys.filter(key => typeof data[0][key] === 'number');
        logger.debug('BarChart data keys', { 
          barDataKeys,
          userId: 'client-side'
        });
        
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <BarChart data={data} margin={chartConfig.margin}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisDataKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {barDataKeys.map((key, index) => (
                <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        const lineDataKeys = dataKeys.filter(key => typeof data[0][key] === 'number');
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <LineChart data={data} margin={chartConfig.margin}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisDataKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {lineDataKeys.map((key, index) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        const areaDataKeys = dataKeys.filter(key => typeof data[0][key] === 'number');
        logger.debug('AreaChart data keys', { 
          areaDataKeys,
          userId: 'client-side'
        });
        
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <AreaChart data={data} margin={chartConfig.margin}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisDataKey} />
              <YAxis />
              <Tooltip />
              <Legend />
            {areaDataKeys.map((key, index) => (
                <Area key={key} type="monotone" dataKey={key} fill={COLORS[index % COLORS.length]} stroke={COLORS[index % COLORS.length]} />
            ))}
          </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        logger.debug('PieChart rendering with data', { 
          data: data.slice(0, 3),
          userId: 'client-side'
        });
        logger.debug('PieChart data structure', { 
          dataStructure: data.slice(0, 3).map(item => ({ 
            keys: Object.keys(item), 
            values: Object.values(item) 
          })),
          userId: 'client-side'
        });
        
        // For pie chart, we need to transform data
        const pieData = data.map(item => ({
          name: item[xAxisDataKey] || 'Unknown',
          value: typeof item[yAxisDataKey] === 'number' ? item[yAxisDataKey] : 1
        }));
        
        logger.debug('PieChart processed data', { 
          pieData: pieData.slice(0, 3),
          userId: 'client-side'
        });
        
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <PieChart margin={chartConfig.margin}>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={80}
                fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
              <Tooltip />
          </PieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        const scatterYKey = dataKeys.find(key => typeof data[0][key] === 'number') || dataKeys[0];
        logger.debug('ScatterChart data keys', { 
          x: xAxisDataKey, 
          y: scatterYKey,
          userId: 'client-side'
        });
        
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={chartConfig.margin}>
              <CartesianGrid />
              <XAxis type="number" dataKey={xAxisDataKey} name={xAxisDataKey} />
              <YAxis type="number" dataKey={scatterYKey} name={scatterYKey} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Data" data={data} fill="#8884d8" />
          </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Unsupported chart type: {chartType}
          </div>
        );
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'negative': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'opportunity': return <Target className="h-4 w-4 text-blue-500" />;
      default: return <Brain className="h-4 w-4 text-gray-500" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'positive': return 'border-green-200 bg-green-50';
      case 'negative': return 'border-red-200 bg-red-50';
      case 'opportunity': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {chartType === 'bar' && <BarChart3 className="h-5 w-5" />}
            {chartType === 'line' && <LineChartIcon className="h-5 w-5" />}
            {chartType === 'area' && <AreaChartIcon className="h-5 w-5" />}
            {chartType === 'pie' && <PieChartIcon className="h-5 w-5" />}
            {chartType === 'scatter' && <ScatterChartIcon className="h-5 w-5" />}
            Enhanced Chart Analysis
          </CardTitle>
          {isInteractive && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('png')}>
                <Download className="h-4 w-4 mr-1" />
                PNG
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
            </div>
                )}
              </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chart">Chart</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="narrative">Narrative</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chart" className="mt-4">
            {renderChart()}
          </TabsContent>
          
          <TabsContent value="insights" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-blue-500" />
                <h3 className="text-lg font-semibold">AI-Generated Insights</h3>
              </div>
              
              {insights.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Brain className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No insights available for this data</p>
            </div>
              ) : (
                <div className="grid gap-4">
                  {insights.map((insight) => (
                    <div
                      key={insight.id}
                      className={`p-4 rounded-lg border ${getInsightColor(insight.type)} cursor-pointer hover:shadow-md transition-shadow`}
                      onClick={() => handleInsightAction(insight)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getInsightIcon(insight.type)}
                          <div>
                            <h4 className="font-medium text-gray-900">{insight.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <div className="text-xs text-gray-500">
                                Confidence: {(insight.confidence * 100).toFixed(0)}%
                              </div>
                              {insight.action && (
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                                  <Zap className="h-3 w-3 mr-1" />
                                  {insight.action}
                                </Button>
            )}
          </div>
        </div>
      </div>
                        <Eye className="h-4 w-4 text-gray-400" />
            </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="narrative" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="text-lg font-semibold">Data Narrative</h3>
              </div>
              
              {narrative ? (
                <div className="prose max-w-none">
                  <p className="text-gray-700 leading-relaxed">{narrative}</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No narrative available for this chart</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 