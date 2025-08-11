"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { 
  BarChart3, 
  TrendingUp, 
  PieChart as PieChartIcon,
  Download,
  Settings,
  Lightbulb,
  Filter,
  RotateCcw,
  Share2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  Activity
} from "lucide-react";

// Enhanced chart types and configurations
interface ChartConfig {
  width: number;
  height: number;
  margin?: Record<string, number>;
  xAxis?: Record<string, unknown>;
  yAxis?: Record<string, unknown>;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  animation?: boolean;
}

interface ChartInsight {
  type: 'trend' | 'anomaly' | 'pattern' | 'recommendation' | 'prediction';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  action?: string;
}

interface EnhancedChartSpec {
  chartType: string;
  data: Record<string, unknown>[];
  chartConfig: ChartConfig;
  title?: string;
  insights?: ChartInsight[];
  dataSource: 'database' | 'file';
  lastUpdated?: string;
  metadata?: {
    totalRecords?: number;
    dateRange?: string;
    filters?: string[];
  };
}

interface EnhancedChartDisplayProps {
  chartSpec?: EnhancedChartSpec;
  narrative?: string;
  onChartUpdate?: (newConfig: Partial<ChartConfig>) => void;
  onExport?: (format: 'png' | 'csv' | 'pdf') => void;
  onShare?: () => void;
  onInsightAction?: (insight: ChartInsight) => void;
  isInteractive?: boolean;
}

const CHART_COLORS = [
  "#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1"
];

export default function EnhancedChartDisplay({ 
  chartSpec, 
  narrative, 
  onChartUpdate,
  onExport,
  onShare,
  onInsightAction,
  isInteractive = true
}: EnhancedChartDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<ChartInsight | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  console.log('🚀 EnhancedChartDisplay received:', { chartSpec, narrative, isInteractive });
  
  if (!chartSpec) {
    return (
      <div className="bg-white rounded-xl border border-[#d9d2c7] shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#f3e89a]/20 to-[#efe076]/20 px-6 py-4 border-b border-[#d9d2c7]">
          <h3 className="text-lg font-semibold text-black">Enhanced Chart Visualization</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center h-64 bg-[#d9d2c7]/10 rounded-lg border-2 border-dashed border-[#d9d2c7]">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-[#d9d2c7] mx-auto mb-3" />
              <p className="text-[#d9d2c7] font-medium">No chart data available</p>
              <p className="text-[#d9d2c7] text-sm mt-1">Ask me to create a chart from your data!</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { chartType, data, chartConfig: specConfig, insights = [], dataSource, metadata } = chartSpec;
  const currentConfig = chartConfig || specConfig;

  console.log('🚀 EnhancedChartDisplay processing:', { 
    chartType, 
    dataLength: data?.length, 
    currentConfig,
    insights: insights.length,
    dataSource 
  });

  // Normalize chart type to handle both short and full names
  const normalizedChartType = chartType.toLowerCase();

  // Ensure we have valid data
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error('❌ EnhancedChartDisplay: Invalid or empty data array');
    return (
      <div className="bg-white rounded-xl border border-[#d9d2c7] shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#f3e89a]/20 to-[#efe076]/20 px-6 py-4 border-b border-[#d9d2c7]">
          <h3 className="text-lg font-semibold text-black">Enhanced Chart Visualization</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center h-64 bg-[#d9d2c7]/10 rounded-lg border-2 border-dashed border-[#d9d2c7]">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-[#d9d2c7] mx-auto mb-3" />
              <p className="text-[#d9d2c7] font-medium">Invalid chart data</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getChartIcon = (type: string) => {
    const normalizedType = type.toLowerCase();
    
    switch (normalizedType) {
      case "line":
      case "linechart":
        return <TrendingUp className="w-5 h-5" />;
      case "bar":
      case "barchart":
        return <BarChart3 className="w-5 h-5" />;
      case "pie":
      case "piechart":
        return <PieChartIcon className="w-5 h-5" />;
      case "area":
      case "areachart":
        return <TrendingUp className="w-5 h-5" />;
      case "scatter":
      case "scatterchart":
        return <BarChart3 className="w-5 h-5" />;
      default:
        return <BarChart3 className="w-5 h-5" />;
    }
  };

  const getInsightIcon = (insight: ChartInsight) => {
    switch (insight.type) {
      case 'trend':
        return <TrendingUp className="w-4 h-4" />;
      case 'anomaly':
        return <AlertTriangle className="w-4 h-4" />;
      case 'pattern':
        return <Sparkles className="w-4 h-4" />;
      case 'recommendation':
        return <Target className="w-4 h-4" />;
      case 'prediction':
        return <Clock className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const handleExport = useCallback((format: 'png' | 'csv' | 'pdf') => {
    if (onExport) {
      onExport(format);
    } else {
      console.log(`Exporting chart as ${format}`);
      // Default export logic here
    }
  }, [onExport]);

  const handleChartUpdate = useCallback((updates: Partial<ChartConfig>) => {
    const newConfig = { ...currentConfig, ...updates };
    setChartConfig(newConfig);
    if (onChartUpdate) {
      onChartUpdate(updates);
    }
  }, [currentConfig, onChartUpdate]);

  const handleInsightAction = useCallback((insight: ChartInsight) => {
    setSelectedInsight(insight);
    if (onInsightAction) {
      onInsightAction(insight);
    }
  }, [onInsightAction]);

  const renderChart = () => {
    const defaultConfig = {
      width: 600,
      height: 400,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
      xAxis: { dataKey: "date" },
      yAxis: { dataKey: "value" },
      colors: CHART_COLORS,
      showGrid: true,
      showLegend: true,
      showTooltip: true,
      animation: true
    };

    const commonProps = {
      data,
      width: currentConfig?.width || defaultConfig.width,
      height: currentConfig?.height || defaultConfig.height,
      margin: currentConfig?.margin || defaultConfig.margin,
    };

    const xAxisDataKey = (currentConfig?.xAxis?.dataKey as string) || defaultConfig.xAxis.dataKey;
    const colors = currentConfig?.colors || defaultConfig.colors;
    
    console.log('🚀 EnhancedChartDisplay rendering with:', { 
      chartType: normalizedChartType, 
      xAxisDataKey, 
      dataSample: data.slice(0, 2), 
      currentConfig 
    });

    switch (normalizedChartType) {
      case "line":
      case "linechart":
        const dataKeys = data.length > 0 ? Object.keys(data[0]).filter(key => key !== xAxisDataKey) : [];
        console.log('🚀 Available data keys:', dataKeys);
        
        return (
          <LineChart {...commonProps}>
            {currentConfig?.showGrid !== false && (
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            )}
            <XAxis 
              dataKey={xAxisDataKey} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            {currentConfig?.showTooltip !== false && (
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
            )}
            {currentConfig?.showLegend !== false && <Legend />}
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={3}
                activeDot={{ r: 8, fill: colors[index % colors.length] }}
                dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
                isAnimationActive={currentConfig?.animation !== false}
              />
            ))}
          </LineChart>
        );

      case "bar":
      case "barchart":
        const barDataKeys = data.length > 0 ? Object.keys(data[0]).filter(key => key !== xAxisDataKey) : [];
        console.log('🚀 BarChart data keys:', barDataKeys);
        
        return (
          <BarChart {...commonProps}>
            {currentConfig?.showGrid !== false && (
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            )}
            <XAxis 
              dataKey={xAxisDataKey} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            {currentConfig?.showTooltip !== false && (
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
            )}
            {currentConfig?.showLegend !== false && <Legend />}
            {barDataKeys.map((key, index) => (
              <Bar 
                key={key}
                dataKey={key} 
                fill={colors[index % colors.length]}
                radius={[4, 4, 0, 0]}
                isAnimationActive={currentConfig?.animation !== false}
              />
            ))}
          </BarChart>
        );

      case "area":
      case "areachart":
        const areaDataKeys = data.length > 0 ? Object.keys(data[0]).filter(key => key !== xAxisDataKey) : [];
        console.log('🚀 AreaChart data keys:', areaDataKeys);
        
        return (
          <AreaChart {...commonProps}>
            {currentConfig?.showGrid !== false && (
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            )}
            <XAxis 
              dataKey={xAxisDataKey} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            {currentConfig?.showTooltip !== false && (
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
            )}
            {currentConfig?.showLegend !== false && <Legend />}
            {areaDataKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.3}
                isAnimationActive={currentConfig?.animation !== false}
              />
            ))}
          </AreaChart>
        );

      case "pie":
      case "piechart":
        const pieDataKey = data.length > 0 ? Object.keys(data[0]).find(key => key !== xAxisDataKey) : 'value';
        console.log('🚀 PieChart data key:', pieDataKey);
        
        return (
          <PieChart {...commonProps}>
            <Pie
              data={data}
              cx={currentConfig.width / 2}
              cy={currentConfig.height / 2}
              labelLine={false}
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#f59e0b"
              dataKey={pieDataKey}
              isAnimationActive={currentConfig?.animation !== false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            {currentConfig?.showTooltip !== false && (
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
            )}
          </PieChart>
        );

      case "scatter":
      case "scatterchart":
        const scatterDataKeys = data.length > 0 ? Object.keys(data[0]).filter(key => key !== xAxisDataKey) : [];
        const scatterYKey = scatterDataKeys[0] || 'value';
        console.log('🚀 ScatterChart data keys:', { x: xAxisDataKey, y: scatterYKey });
        
        return (
          <ScatterChart {...commonProps}>
            {currentConfig?.showGrid !== false && (
              <CartesianGrid stroke="#e2e8f0" />
            )}
            <XAxis 
              dataKey={xAxisDataKey} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis 
              dataKey={scatterYKey} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            {currentConfig?.showTooltip !== false && (
              <Tooltip 
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
            )}
            {currentConfig?.showLegend !== false && <Legend />}
            <Scatter 
              name="Data" 
              data={data} 
              fill={colors[0]}
              isAnimationActive={currentConfig?.animation !== false}
            />
          </ScatterChart>
        );

      default:
        return (
          <div className="flex items-center justify-center h-64 bg-[#d9d2c7]/10 rounded-lg border-2 border-dashed border-[#d9d2c7]">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-[#d9d2c7] mx-auto mb-3" />
              <p className="text-[#d9d2c7] font-medium">Chart type &quot;{chartType}&quot; not supported</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#d9d2c7] shadow-sm overflow-hidden">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-[#f3e89a]/20 to-[#efe076]/20 px-6 py-4 border-b border-[#d9d2c7]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-[#f3e89a] to-[#efe076] rounded-lg">
              {getChartIcon(normalizedChartType)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-black">
                {chartSpec.title || 'Enhanced Chart Visualization'}
              </h3>
              <div className="flex items-center space-x-2 text-xs text-gray-600 mt-1">
                <span className="bg-white px-2 py-1 rounded-full border border-[#d9d2c7]">
                  {dataSource === 'database' ? 'CRM Data' : 'File Data'}
                </span>
                <span className="bg-white px-2 py-1 rounded-full border border-[#d9d2c7]">
                  {normalizedChartType}
                </span>
                <span className="bg-white px-2 py-1 rounded-full border border-[#d9d2c7]">
                  {data.length} data points
                </span>
                {metadata?.totalRecords && (
                  <span className="bg-white px-2 py-1 rounded-full border border-[#d9d2c7]">
                    {metadata.totalRecords} total
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Enhanced Controls */}
          <div className="flex items-center space-x-2">
            {isInteractive && (
              <>
                <button
                  onClick={() => setShowControls(!showControls)}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                  title="Chart Settings"
                >
                  <Settings className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => setShowInsights(!showInsights)}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                  title="Toggle Insights"
                >
                  {showInsights ? <EyeOff className="w-4 h-4 text-gray-600" /> : <Eye className="w-4 h-4 text-gray-600" />}
                </button>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                  title="Expand/Collapse"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
                </button>
              </>
            )}
            
            {/* Export Options */}
            <div className="relative group">
              <button
                onClick={() => handleExport('png')}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                title="Export Chart"
              >
                <Download className="w-4 h-4 text-gray-600" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 min-w-[120px]">
                <button
                  onClick={() => handleExport('png')}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg"
                >
                  Export as PNG
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg"
                >
                  Export as PDF
                </button>
              </div>
            </div>

            {onShare && (
              <button
                onClick={onShare}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                title="Share Chart"
              >
                <Share2 className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Chart Controls Panel */}
      {showControls && isInteractive && (
        <div className="bg-gray-50 border-b border-[#d9d2c7] px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Show Grid</label>
              <input
                type="checkbox"
                checked={currentConfig?.showGrid !== false}
                onChange={(e) => handleChartUpdate({ showGrid: e.target.checked })}
                className="rounded border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Show Legend</label>
              <input
                type="checkbox"
                checked={currentConfig?.showLegend !== false}
                onChange={(e) => handleChartUpdate({ showLegend: e.target.checked })}
                className="rounded border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Show Tooltip</label>
              <input
                type="checkbox"
                checked={currentConfig?.showTooltip !== false}
                onChange={(e) => handleChartUpdate({ showTooltip: e.target.checked })}
                className="rounded border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Animation</label>
              <input
                type="checkbox"
                checked={currentConfig?.animation !== false}
                onChange={(e) => handleChartUpdate({ animation: e.target.checked })}
                className="rounded border-gray-300"
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Chart */}
      <div className="p-6">
        <div className="mb-6" ref={chartRef}>
          <ResponsiveContainer width="100%" height={isExpanded ? 600 : 400}>
            {renderChart()}
          </ResponsiveContainer>
        </div>

        {/* AI Insights Panel */}
        {showInsights && insights.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-black flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-[#f3e89a]" />
                AI Insights
              </h4>
              <span className="text-sm text-gray-500">{insights.length} insights</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${getImpactColor(insight.impact)} cursor-pointer hover:shadow-md transition-shadow`}
                  onClick={() => handleInsightAction(insight)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getInsightIcon(insight)}
                      <span className="text-xs font-medium uppercase tracking-wide">
                        {insight.type}
                      </span>
                    </div>
                    <span className="text-xs bg-white/50 px-2 py-1 rounded-full">
                      {insight.confidence}%
                    </span>
                  </div>
                  <h5 className="font-medium text-sm mb-1">{insight.title}</h5>
                  <p className="text-xs opacity-80">{insight.description}</p>
                  {insight.action && (
                    <button className="text-xs underline mt-2 hover:no-underline">
                      {insight.action}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Narrative */}
        {narrative && (
          <div className="bg-gradient-to-r from-[#f3e89a]/10 to-[#efe076]/10 border border-[#f3e89a]/20 rounded-xl p-4">
            <h4 className="font-semibold text-black mb-2 flex items-center">
              <Lightbulb className="w-4 h-4 mr-2 text-[#f3e89a]" />
              Analysis Summary
            </h4>
            <p className="text-black text-sm leading-relaxed">{narrative}</p>
          </div>
        )}

        {/* Metadata Footer */}
        {(metadata?.dateRange || metadata?.filters?.length) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center space-x-4">
                {metadata.dateRange && (
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {metadata.dateRange}
                  </span>
                )}
                {metadata.filters && metadata.filters.length > 0 && (
                  <span className="flex items-center">
                    <Filter className="w-3 h-3 mr-1" />
                    {metadata.filters.length} filter{metadata.filters.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {chartSpec.lastUpdated && (
                <span>Updated: {new Date(chartSpec.lastUpdated).toLocaleString()}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 