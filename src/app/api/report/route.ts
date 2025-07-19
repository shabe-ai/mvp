import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type DataPoint = {
  date?: string;
  month?: string;
  sales?: number;
  orders?: number;
  activeUsers?: number;
  newUsers?: number;
  events?: number;
  attendees?: number;
  value?: number;
  [key: string]: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, dataType, timeRange } = body;

    console.log("Report API called with:", { query, dataType, timeRange });

    // Simulate querying Convex data
    // In a real implementation, this would query your Convex database
    const mockData = generateMockData(dataType);
    
    console.log("Mock data generated:", mockData);

    // Generate chart specification using OpenAI
    const chartResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: [
        {
          role: "system",
          content: "You are a data visualization expert. Generate a Recharts chart specification based on the provided data. Return a JSON object with chartType, data, and chartConfig properties. Chart types can be: LineChart, BarChart, PieChart, AreaChart, ScatterChart. Return ONLY the JSON object, no markdown formatting."
        },
        {
          role: "user",
          content: `Generate a chart for this data: ${JSON.stringify(mockData)}. Query: ${query}`
        }
      ],
      stream: false,
    });

    let chartSpec;
    try {
      const chartContent = chartResponse.choices[0]?.message?.content || "{}";
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = chartContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : chartContent;
      chartSpec = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Error parsing chart spec:", parseError);
      // Fallback to default chart spec
      chartSpec = {
        chartType: "LineChart",
        data: mockData,
        chartConfig: {
          width: 600,
          height: 400,
          margin: { top: 5, right: 30, left: 20, bottom: 5 },
          xAxis: { dataKey: "date" },
          yAxis: { dataKey: "sales" }
        }
      };
    }

    // Generate narrative using OpenAI
    const narrativeResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: [
        {
          role: "system",
          content: "You are a business analyst. Generate a concise narrative (2-3 sentences) explaining the key insights from the data."
        },
        {
          role: "user",
          content: `Generate a narrative for this data: ${JSON.stringify(mockData)}. Query: ${query}`
        }
      ],
      stream: false,
    });

    const narrative = narrativeResponse.choices[0]?.message?.content || "No narrative generated";

    console.log("Generated chart spec:", chartSpec);
    console.log("Generated narrative:", narrative);

    return NextResponse.json({
      success: true,
      chartSpec,
      narrative,
      data: mockData
    });

  } catch (error) {
    console.error("❌ Error generating report:", error);
    
    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate report",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

function generateMockData(dataType: string): DataPoint[] {
  const now = new Date();
  const data: DataPoint[] = [];
  
  // Generate mock data based on type
  switch (dataType) {
    case "sales":
      for (let i = 30; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        data.push({
          date: date.toISOString().split('T')[0],
          sales: Math.floor(Math.random() * 1000) + 500,
          orders: Math.floor(Math.random() * 50) + 20
        });
      }
      break;
    
    case "users":
      for (let i = 7; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        data.push({
          date: date.toISOString().split('T')[0],
          activeUsers: Math.floor(Math.random() * 100) + 50,
          newUsers: Math.floor(Math.random() * 20) + 5
        });
      }
      break;
    
    case "events":
      for (let i = 12; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 30 * 24 * 60 * 60 * 1000);
        data.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          events: Math.floor(Math.random() * 50) + 10,
          attendees: Math.floor(Math.random() * 200) + 50
        });
      }
      break;
    
    default:
      // Default to sales data
      for (let i = 7; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        data.push({
          date: date.toISOString().split('T')[0],
          value: Math.floor(Math.random() * 100) + 25
        });
      }
  }
  
  return data;
}
