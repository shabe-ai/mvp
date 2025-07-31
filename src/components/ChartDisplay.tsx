"use client";

import React from "react";
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
} from "recharts";
import { BarChart3, TrendingUp, PieChart as PieChartIcon } from "lucide-react";

type ChartDisplayProps = {
  chartSpec?: {
    chartType: string;
    data: Record<string, unknown>[];
    chartConfig: {
      width: number;
      height: number;
      margin?: Record<string, number>;
      xAxis?: Record<string, unknown>;
      yAxis?: Record<string, unknown>;
    };
  };
  narrative?: string;
};

export default function ChartDisplay({ chartSpec, narrative }: ChartDisplayProps) {
  console.log('📊 ChartDisplay received:', { chartSpec, narrative });
  
  if (!chartSpec) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 to-yellow-100 px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Chart Visualization</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center h-64 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No chart data available</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { chartType, data, chartConfig } = chartSpec;

  console.log('📊 ChartDisplay processing:', { chartType, dataLength: data?.length, chartConfig });

  // Ensure we have valid data
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error('❌ ChartDisplay: Invalid or empty data array');
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 to-yellow-100 px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Chart Visualization</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center h-64 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Invalid chart data</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getChartIcon = (type: string) => {
    switch (type) {
      case "LineChart":
        return <TrendingUp className="w-5 h-5" />;
      case "BarChart":
        return <BarChart3 className="w-5 h-5" />;
      case "PieChart":
        return <PieChartIcon className="w-5 h-5" />;
      default:
        return <BarChart3 className="w-5 h-5" />;
    }
  };

  const renderChart = () => {
    // Provide default values for missing chartConfig properties
    const defaultConfig = {
      width: 600,
      height: 400,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
      xAxis: { dataKey: "date" },
      yAxis: { dataKey: "value" }
    };

    const commonProps = {
      data,
      width: chartConfig?.width || defaultConfig.width,
      height: chartConfig?.height || defaultConfig.height,
      margin: chartConfig?.margin || defaultConfig.margin,
    };

    const xAxisDataKey = (chartConfig?.xAxis?.dataKey as string) || defaultConfig.xAxis.dataKey;
    const yAxisDataKey = (chartConfig?.yAxis?.dataKey as string) || defaultConfig.yAxis.dataKey;

    console.log('📊 ChartDisplay rendering with:', { chartType, xAxisDataKey, yAxisDataKey, dataSample: data.slice(0, 2) });

    switch (chartType) {
      case "LineChart":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey={xAxisDataKey} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={yAxisDataKey}
              stroke="#f59e0b"
              strokeWidth={3}
              activeDot={{ r: 8, fill: '#f59e0b' }}
              dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        );

      case "BarChart":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey={xAxisDataKey} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Legend />
            <Bar 
              dataKey={yAxisDataKey} 
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );

      case "AreaChart":
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey={xAxisDataKey} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey={yAxisDataKey}
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.3}
            />
          </AreaChart>
        );

      case "PieChart":
        return (
          <PieChart {...commonProps}>
            <Pie
              data={data}
              cx={chartConfig.width / 2}
              cy={chartConfig.height / 2}
              labelLine={false}
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#f59e0b"
              dataKey={yAxisDataKey}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
          </PieChart>
        );

      case "ScatterChart":
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid stroke="#e2e8f0" />
            <XAxis 
              dataKey={xAxisDataKey} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis 
              dataKey={yAxisDataKey} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Legend />
            <Scatter name="Data" data={data} fill="#f59e0b" />
          </ScatterChart>
        );

      default:
        return (
          <div className="flex items-center justify-center h-64 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Chart type &quot;{chartType}&quot; not supported</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-100 px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-lg">
              {getChartIcon(chartType)}
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Chart Visualization</h3>
          </div>
          <div className="flex items-center space-x-4 text-sm text-slate-600">
            <span className="bg-white px-3 py-1 rounded-full border border-slate-200">
              {chartType}
            </span>
            <span className="bg-white px-3 py-1 rounded-full border border-slate-200">
              {data.length} data points
            </span>
          </div>
        </div>
      </div>
      
      {/* Chart */}
      <div className="p-6">
        <div className="mb-6">
          <ResponsiveContainer width="100%" height={400}>
            {renderChart()}
          </ResponsiveContainer>
        </div>

        {/* Insights */}
        {narrative && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-100 border border-amber-200 rounded-xl p-4">
            <h4 className="font-semibold text-amber-900 mb-2 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Insights
            </h4>
            <p className="text-amber-800 text-sm leading-relaxed">{narrative}</p>
          </div>
        )}
      </div>
    </div>
  );
} 