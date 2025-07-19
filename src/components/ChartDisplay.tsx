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
  if (!chartSpec) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
          <p className="text-gray-500">No chart data available</p>
        </div>
      </div>
    );
  }

  const { chartType, data, chartConfig } = chartSpec;

  const renderChart = () => {
    const commonProps = {
      data,
      width: chartConfig.width,
      height: chartConfig.height,
      margin: chartConfig.margin || { top: 5, right: 30, left: 20, bottom: 5 },
    };

    const xAxisDataKey = (chartConfig.xAxis?.dataKey as string) || "date";
    const yAxisDataKey = (chartConfig.yAxis?.dataKey as string) || "value";

    switch (chartType) {
      case "LineChart":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisDataKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey={yAxisDataKey}
              stroke="#8884d8"
              activeDot={{ r: 8 }}
            />
          </LineChart>
        );

      case "BarChart":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisDataKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={yAxisDataKey} fill="#8884d8" />
          </BarChart>
        );

      case "AreaChart":
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisDataKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey={yAxisDataKey}
              stroke="#8884d8"
              fill="#8884d8"
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
              fill="#8884d8"
              dataKey={yAxisDataKey}
            />
            <Tooltip />
          </PieChart>
        );

      case "ScatterChart":
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid />
            <XAxis dataKey={xAxisDataKey} />
            <YAxis dataKey={yAxisDataKey} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Legend />
            <Scatter name="Data" data={data} fill="#8884d8" />
          </ScatterChart>
        );

      default:
        return (
          <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
            <p className="text-gray-500">Chart type &quot;{chartType}&quot; not supported</p>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Chart Visualization</h3>
        <p className="text-sm text-gray-600">Chart Type: {chartType}</p>
        <p className="text-sm text-gray-600">Data Points: {data.length}</p>
      </div>
      
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={400}>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {narrative && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Insights</h4>
          <p className="text-blue-800 text-sm">{narrative}</p>
        </div>
      )}
    </div>
  );
} 