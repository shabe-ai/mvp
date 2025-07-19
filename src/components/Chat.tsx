"use client";

import React, { useState } from "react";
import PreviewCard from "./PreviewCard";
import ChartDisplay from "./ChartDisplay";
import Logo from "./Logo";
import { Send, Bot, User, Sparkles } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type PreviewData = {
  title: string;
  content: string;
  subject?: string;
  action?: "send_email" | "create_event" | "generate_report";
  event?: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    attendees: string[];
  };
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
  data?: Record<string, unknown>[];
  dataType?: string;
  timeRange?: string;
};

// Import the type from PreviewCard
type PreviewCardData = {
  title: string;
  content: string;
  subject?: string;
  action?: "send" | "edit" | "cancel";
};

function useSimpleChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [lastEmailRequest, setLastEmailRequest] = useState<string>("");
  const [chartData, setChartData] = useState<{
    chartSpec?: PreviewData['chartSpec'];
    narrative?: string;
  } | null>(null);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setIsLoading(true);
    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setChartData(null);
    try {
      console.log("Sending request to /api/chat with messages:", [...messages, userMessage]);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Response data:", data);
        const assistantReply = data.choices?.[0]?.message?.content || "No response";
        
        console.log("Raw AI response:", assistantReply);
        
        // Try to parse the response as JSON
        let parsedReply;
        try {
          parsedReply = JSON.parse(assistantReply);
          console.log("Successfully parsed JSON:", parsedReply);
        } catch (parseError) {
          console.log("Failed to parse JSON:", parseError);
          // Not JSON, treat as regular message
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: assistantReply }
          ]);
          setPreviewData(null);
          return;
        }
        
        // If it's a structured action, show preview card
        if (parsedReply.action) {
          console.log("Setting preview data:", parsedReply);
          
          // Format the content based on the action type
          let formattedContent = parsedReply.content || assistantReply;
          let formattedTitle = parsedReply.title || "Action Preview";
          
          if (parsedReply.action === "create_event" && parsedReply.event) {
            // Format event data for user-friendly display
            const event = parsedReply.event;
            formattedTitle = event.title || "Create Event";
            formattedContent = `Event: ${event.title || "Untitled Event"}
Description: ${event.description || "No description"}
Start Time: ${new Date(event.startTime).toLocaleString()}
End Time: ${new Date(event.endTime).toLocaleString()}
Attendees: ${event.attendees?.length ? event.attendees.join(", ") : "None"}`;
          } else if (parsedReply.action === "generate_report") {
            // Format report data for user-friendly display
            formattedTitle = `Report: ${parsedReply.dataType || "Data"} (${parsedReply.timeRange || "30d"})`;
            formattedContent = `Chart Type: ${parsedReply.chartSpec?.chartType || "Unknown"}
Data Points: ${parsedReply.data?.length || 0}
Narrative: ${parsedReply.narrative || "No narrative available"}`;
          }
          
          setPreviewData({
            title: formattedTitle,
            content: formattedContent,
            subject: parsedReply.subject,
            action: parsedReply.action,
            event: parsedReply.event,
            chartSpec: parsedReply.chartSpec,
            narrative: parsedReply.narrative,
            data: parsedReply.data,
            dataType: parsedReply.dataType,
            timeRange: parsedReply.timeRange,
          });
          // Store the original user message for extraction
          if (parsedReply.action === "send_email") {
            setLastEmailRequest(userMessage.content);
          }
          // Also show a user-friendly message in chat
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `I'll help you ${parsedReply.action.replace('_', ' ')}. Please review the details below.` }
          ]);
        } else {
          console.log("No action found in parsed reply, showing as regular message");
          // Regular JSON response, show as normal message
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: assistantReply }
          ]);
          setPreviewData(null);
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviewSend = async (data: PreviewCardData) => {
    // Handle the preview action (send email, create event, generate report, etc.)
    console.log("Sending action:", data);
    
    try {
      if (previewData?.action === "send_email") {
        // Handle email sending
        console.log("Extracting email from original request:", lastEmailRequest);
        
        // Improved regex to capture email address after "to"
        const emailMatch = lastEmailRequest.match(/to\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        const toEmail = emailMatch ? emailMatch[1] : "recipient@example.com";
        
        console.log("Extracted email:", toEmail);
        
        // Send the email via API
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: toEmail,
            subject: data.subject || "Email",
            content: data.content
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log("Email sent successfully:", result);
          
          setPreviewData(null);
          // Add a confirmation message to chat
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `✅ Email sent successfully to ${toEmail}!` }
          ]);
        } else {
          throw new Error("Failed to send email");
        }
      } else if (previewData?.action === "create_event") {
        // Handle event creation
        console.log("Creating event with data:", previewData.event);
        
        const eventData = previewData.event || {
          title: data.title,
          description: data.content,
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
          attendees: []
        };
        
        // Send the event creation request via API
        const response = await fetch("/api/create-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventData),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log("Event created successfully:", result);
          
          setPreviewData(null);
          // Add a confirmation message to chat
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `✅ Event "${eventData.title}" created successfully!` }
          ]);
        } else {
          throw new Error("Failed to create event");
        }
      } else if (previewData?.action === "generate_report") {
        // Handle report generation - show the chart
        console.log("Showing chart for report:", previewData);
        
        setPreviewData(null);
        if (previewData.chartSpec) {
          setChartData({
            chartSpec: previewData.chartSpec,
            narrative: previewData.narrative,
          });
        }
        // Add a confirmation message to chat
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `✅ Report generated successfully! Here's your chart visualization.` }
        ]);
      }
    } catch (error) {
      console.error("Error handling preview action:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Sorry, there was an error processing your request. Please try again." }
      ]);
    }
  };

  const handlePreviewEdit = (data: PreviewCardData) => {
    console.log("Editing preview data:", data);
    // Update the preview data with edited content
    if (previewData) {
      setPreviewData({
        ...previewData,
        title: data.title,
        content: data.content,
        subject: data.subject,
      });
    }
  };

  const handlePreviewCancel = () => {
    console.log("Cancelling preview");
    setPreviewData(null);
    setChartData(null);
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    sendMessage,
    previewData,
    chartData,
    handlePreviewSend,
    handlePreviewEdit,
    handlePreviewCancel,
  };
}

export default function Chat() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    sendMessage,
    previewData,
    chartData,
    handlePreviewSend,
    handlePreviewEdit,
    handlePreviewCancel,
  } = useSimpleChat();

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      {/* Welcome Header */}
      {messages.length === 0 && (
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">
            Welcome to Shabe
          </h1>
          <p className="text-slate-600 text-lg mb-6 max-w-2xl mx-auto leading-relaxed">
            Your AI-powered conversational workspace. Send emails, create events, generate reports, and more - all through natural language.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-500">
            <span className="bg-white px-3 py-1 rounded-full border border-slate-200 font-medium">
              &quot;Send an email to john@example.com&quot;
            </span>
            <span className="bg-white px-3 py-1 rounded-full border border-slate-200 font-medium">
              &quot;Create a meeting tomorrow at 2pm&quot;
            </span>
            <span className="bg-white px-3 py-1 rounded-full border border-slate-200 font-medium">
              &quot;Generate a sales report&quot;
            </span>
          </div>
        </div>
      )}

      {/* Chat Container */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-start space-x-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-amber-500 to-yellow-600 text-white"
                    : "bg-slate-100 text-slate-900"
                }`}
              >
                <p className="text-sm leading-relaxed font-medium">{message.content}</p>
              </div>
              
              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-slate-100 px-4 py-3 rounded-2xl">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-4 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview Card */}
        {previewData && (
          <div className="border-t border-slate-200 p-6">
            <PreviewCard
              initialData={{
                title: previewData.title,
                content: previewData.content,
                subject: previewData.subject,
              }}
              onSend={handlePreviewSend}
              onEdit={handlePreviewEdit}
              onCancel={handlePreviewCancel}
              title={`Preview: ${previewData.action?.replace('_', ' ').toUpperCase()}`}
              isEditable={true}
            />
          </div>
        )}

        {/* Chart Display */}
        {chartData && (
          <div className="border-t border-slate-200 p-6">
            <ChartDisplay
              chartSpec={chartData.chartSpec}
              narrative={chartData.narrative}
            />
          </div>
        )}

        {/* Input Form */}
        <div className="border-t border-slate-200 p-6">
          <form onSubmit={sendMessage} className="flex space-x-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything... Send emails, create events, generate reports..."
                className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 font-medium"
                disabled={isLoading}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Sparkles className="w-5 h-5 text-slate-400" />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 