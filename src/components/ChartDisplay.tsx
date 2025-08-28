"use client";

import React, { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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
import { BarChart3, TrendingUp, PieChart as PieChartIcon, Download, Palette, Settings, FileSpreadsheet } from "lucide-react";

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
  onExport?: (format: string) => void;
  onColorChange?: (colors: string[]) => void;
  onGoogleSheetsExport?: (chartData: any[], chartConfig: any, chartTitle: string) => void;
};

export default function ChartDisplay({ chartSpec, narrative, onExport, onColorChange, onGoogleSheetsExport }: ChartDisplayProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentColors, setCurrentColors] = useState([
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'
  ]);
  
  console.log('📊 ChartDisplay received:', { chartSpec, narrative });
  
  if (!chartSpec) {
    return (
      <div className="bg-white rounded-xl border border-[#d9d2c7] shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#f3e89a]/20 to-[#efe076]/20 px-6 py-4 border-b border-[#d9d2c7]">
          <h3 className="text-lg font-semibold text-black">Chart Visualization</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center h-64 bg-[#d9d2c7]/10 rounded-lg border-2 border-dashed border-[#d9d2c7]">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-[#d9d2c7] mx-auto mb-3" />
              <p className="text-[#d9d2c7] font-medium">No chart data available</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { chartType, data, chartConfig } = chartSpec;

  console.log('📊 ChartDisplay processing:', { chartType, dataLength: data?.length, chartConfig });

  // Normalize chart type to handle both short and full names
  const normalizedChartType = chartType.toLowerCase();

  // Ensure we have valid data
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error('❌ ChartDisplay: Invalid or empty data array');
    return (
      <div className="bg-white rounded-xl border border-[#d9d2c7] shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#f3e89a]/20 to-[#efe076]/20 px-6 py-4 border-b border-[#d9d2c7]">
          <h3 className="text-lg font-semibold text-black">Chart Visualization</h3>
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
    // Normalize chart type to handle both short and full names
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

  const renderChart = () => {
    // Provide default values for missing chartConfig properties
    const defaultConfig = {
      width: 700,
      height: 500,
      margin: { top: 20, right: 80, left: 20, bottom: 20 },
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
    
    // For LineChart, we need to handle multiple data series
    console.log('📊 ChartDisplay rendering with:', { chartType: normalizedChartType, xAxisDataKey, dataSample: data.slice(0, 2), chartConfig });

    switch (normalizedChartType) {
      case "line":
      case "linechart":
        // Check if we have multiple data series (sales, orders, etc.)
        const dataKeys = data.length > 0 ? Object.keys(data[0]).filter(key => key !== xAxisDataKey) : [];
        console.log('📊 Available data keys:', dataKeys);
        
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
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={currentColors[index % currentColors.length]}
                strokeWidth={3}
                activeDot={{ r: 8, fill: currentColors[index % currentColors.length] }}
                dot={{ fill: currentColors[index % currentColors.length], strokeWidth: 2, r: 4 }}
              />
            ))}
          </LineChart>
        );

      case "bar":
      case "barchart":
        // Check if we have multiple data series or single value data
        const barDataKeys = data.length > 0 ? Object.keys(data[0]).filter(key => key !== xAxisDataKey) : [];
        console.log('📊 BarChart data keys:', barDataKeys);
        
        // For single value data (like deals by stage), use the first non-x-axis key
        const primaryDataKey = barDataKeys[0] || 'value';
        
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
              formatter={(value, name, props) => {
                const formattedValue = typeof value === 'number' ? `$${value.toLocaleString()}` : value;
                return [formattedValue, primaryDataKey];
              }}
            />
            <Legend />
            {barDataKeys.length > 1 ? (
              // Multiple data series
              barDataKeys.map((key, index) => (
                <Bar 
                  key={key}
                  dataKey={key} 
                  fill={currentColors[index % currentColors.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))
            ) : (
              // Single data series - use Cell components for different colors
              <Bar 
                dataKey={primaryDataKey} 
                radius={[4, 4, 0, 0]}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={currentColors[index % currentColors.length]} />
                ))}
              </Bar>
            )}
          </BarChart>
        );

      case "area":
      case "areachart":
        // Check if we have multiple data series
        const areaDataKeys = data.length > 0 ? Object.keys(data[0]).filter(key => key !== xAxisDataKey) : [];
        console.log('📊 AreaChart data keys:', areaDataKeys);
        
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
            {areaDataKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={currentColors[index % currentColors.length]}
                fill={currentColors[index % currentColors.length]}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        );

      case "pie":
      case "piechart":
        // For pie charts, we need to use the first data key that's not the x-axis
        const pieDataKey: string = data.length > 0 
          ? Object.keys(data[0]).find(key => key !== xAxisDataKey) || (chartConfig.yAxis?.dataKey as string) || 'value'
          : 'value';
        console.log('📊 PieChart data key:', pieDataKey);
        console.log('📊 PieChart data structure:', data[0]);
        
        return (
          <PieChart {...commonProps}>
            <Pie
              data={data}
              cx={chartConfig.width / 2}
              cy={chartConfig.height / 2}
              labelLine={true}
              label={({ payload, percent }) => {
                // Use the xAxisDataKey (e.g., 'stage') for the name, and format the value
                const name = payload[xAxisDataKey] || payload.name || 'Unknown';
                const value = payload[pieDataKey] || 0;
                return `${name} ${((percent || 0) * 100).toFixed(0)}%`;
              }}
              outerRadius={Math.min(chartConfig.width, chartConfig.height) * 0.35}
              innerRadius={Math.min(chartConfig.width, chartConfig.height) * 0.15}
              fill="#f59e0b"
              dataKey={pieDataKey}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={currentColors[index % currentColors.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value, name, props) => {
                const stageName = props.payload[xAxisDataKey] || props.payload.name || 'Unknown';
                const formattedValue = typeof value === 'number' ? `$${value.toLocaleString()}` : value;
                return [formattedValue, stageName];
              }}
            />
          </PieChart>
        );

      case "scatter":
      case "scatterchart":
        // For scatter charts, we need two data keys for x and y
        const scatterDataKeys = data.length > 0 ? Object.keys(data[0]).filter(key => key !== xAxisDataKey) : [];
        const scatterYKey = scatterDataKeys[0] || 'value';
        console.log('📊 ScatterChart data keys:', { x: xAxisDataKey, y: scatterYKey });
        
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid stroke="#e2e8f0" />
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
            <Scatter name="Data" data={data} fill={currentColors[0]} />
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
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden" data-chart-export>
      {/* Header - Only show for fullscreen charts */}
      {chartConfig?.height > 300 && (
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
                {getChartIcon(normalizedChartType)}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Chart Visualization</h3>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="bg-white px-3 py-1 rounded-full border border-gray-200">
                {normalizedChartType}
              </span>
              <span className="bg-white px-3 py-1 rounded-full border border-gray-200">
                {data.length} data points
              </span>
              
              {/* Color Picker Button */}
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="bg-white px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1"
                title="Customize colors"
              >
                <Palette className="w-3 h-3" />
                Colors
              </button>
              
              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                {onExport && (
                  <button
                    onClick={() => onExport('png')}
                    className="bg-white px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1"
                    title="Export as PNG"
                  >
                    <Download className="w-3 h-3" />
                    PNG
                  </button>
                )}
                {onGoogleSheetsExport && (
                  <button
                    onClick={() => onGoogleSheetsExport(data, chartConfig, `Chart - ${normalizedChartType}`)}
                    className="bg-white px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1"
                    title="Export to Google Sheets"
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    Sheets
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Chart */}
      <div className={chartConfig?.height > 300 ? "p-6" : "p-4"}>
        {/* Color Picker Dropdown */}
        {showColorPicker && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Customize Chart Colors
            </h4>
            <div className="grid grid-cols-6 gap-2">
              {currentColors.map((color, index) => (
                <div key={index} className="flex flex-col items-center gap-1">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const newColors = [...currentColors];
                      newColors[index] = e.target.value;
                      setCurrentColors(newColors);
                      if (onColorChange) {
                        onColorChange(newColors);
                      }
                    }}
                    className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                    title={`Color ${index + 1}`}
                  />
                  <span className="text-xs text-gray-500">{index + 1}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setCurrentColors(['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'])}
                className="text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                Reset to Default
              </button>
              <button
                onClick={() => setShowColorPicker(false)}
                className="text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
        
        <div className={chartConfig?.height > 300 ? "mb-6" : "mb-0"}>
          <ResponsiveContainer width="100%" height={chartConfig?.height < 200 ? 240 : (chartConfig?.height > 300 ? 500 : 260)}>
            {renderChart()}
          </ResponsiveContainer>
        </div>

        {/* Chart Data for Export */}
        <div 
          data-chart-data={JSON.stringify(data)}
          style={{ display: 'none' }}
        />
        
        {/* Insights - Only show for fullscreen charts */}
        {narrative && chartConfig?.height > 300 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
              Insights
            </h4>
            <p className="text-gray-700 text-sm leading-relaxed">{narrative}</p>
          </div>
        )}
      </div>
    </div>
  );
} 