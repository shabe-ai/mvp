"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { 
  Send, 
  MessageSquare,
  Loader2,
  Upload
} from "lucide-react";
import PreviewCard from "@/components/PreviewCard";
import ChartDisplay from "@/components/ChartDisplay";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  action?: string;
  data?: Record<string, unknown>;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  fields?: string[];
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
}

export default function Chat() {
  const { user, isLoaded } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [emailDraft, setEmailDraft] = useState<{
    to: string;
    subject: string;
    content: string;
    aiMessage: Message;
    activityData: Record<string, unknown>;
  } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sessionFiles, setSessionFiles] = useState<Array<{
    id: string;
    name: string;
    content: string;
  }>>([]);

  // Initialize with welcome message if user is logged in
  useEffect(() => {
    if (user && isLoaded && messages.length === 0) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Hello! I'm your AI assistant. Upload a file and I'll help you analyze it, generate charts, and provide insights. What would you like to do?",
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [user, isLoaded, messages.length]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          userId: user.id,
          sessionFiles: sessionFiles,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        action: data.action,
        data: data.data,
        needsClarification: data.needsClarification,
        clarificationQuestion: data.clarificationQuestion,
        fields: data.fields,
        chartSpec: data.chartSpec,
        narrative: data.narrative,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Handle email draft if present
      if (data.emailDraft) {
        setEmailDraft({
          to: data.emailDraft.to,
          subject: data.emailDraft.subject,
          content: data.emailDraft.content,
          aiMessage: assistantMessage,
          activityData: data.activityData || {},
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === "user";
    
    return (
      <div
        key={message.id}
        className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
      >
        <div
          className={`max-w-[80%] rounded-lg px-4 py-2 ${
            isUser
              ? "bg-yellow-400 text-white"
              : "bg-gray-100 text-gray-900"
          }`}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
          
                     {/* Render chart if present */}
           {message.chartSpec && (
             <div className="mt-4">
               <ChartDisplay
                 chartSpec={message.chartSpec}
                 narrative={message.narrative}
               />
             </div>
           )}
          
          {/* Render data table if present */}
          {message.data && Array.isArray(message.data) && message.data.length > 0 && (
            <div className="mt-4">
              <DataTable data={message.data} fields={message.fields} />
            </div>
          )}
          
          {/* Render clarification question if present */}
          {message.needsClarification && message.clarificationQuestion && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm font-medium mb-2">🤔 I need clarification:</p>
              <p className="text-yellow-700 text-sm">{message.clarificationQuestion}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleSendEmail = async (draft: { to: string; subject: string; content: string }) => {
    if (!emailDraft) return;
    
    setSendingEmail(true);
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: draft.to,
          subject: draft.subject,
          content: draft.content,
          userId: user?.id,
        }),
      });

      if (response.ok) {
        const successMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: "✅ Email sent successfully!",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, successMessage]);
        setEmailDraft(null);
      } else {
        throw new Error("Failed to send email");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "❌ Failed to send email. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCancelEmail = () => {
    setEmailDraft(null);
  };

  const handleFilesProcessed = (files: Array<{
    id: string;
    name: string;
    content?: string;
  }>) => {
    console.log('Files processed:', files);
    // Filter out files without content and ensure content is required
    const filesWithContent = files
      .filter(file => file.content)
      .map(file => ({
        id: file.id,
        name: file.name,
        content: file.content!
      }));
    
    setSessionFiles(filesWithContent);
    
    // Add a message to indicate files were uploaded
    const fileMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: `📄 Uploaded ${filesWithContent.length} file${filesWithContent.length > 1 ? 's' : ''} for this session. I can now analyze these files and help you with insights!`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, fileMessage]);
  };

  // Show loading state while user is being loaded
  if (!isLoaded) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-gray-500">Loading...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show sign-in prompt if user is not authenticated
  if (!user) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500">
            Please sign in to access the AI assistant.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div style={{ width: '100%', background: '#fff' }} className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-6 pb-4" style={{ width: '100%' }}>
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>

      {/* Email Preview */}
      {emailDraft && (
        <div className="mb-6">
          <PreviewCard
            initialData={{
              title: "Send Email",
              subject: emailDraft.subject,
              content: emailDraft.content,
            }}
            onSend={(data) => handleSendEmail({
              to: emailDraft.to,
              subject: data.subject || emailDraft.subject,
              content: data.content || emailDraft.content,
            })}
            onCancel={handleCancelEmail}
            isEditable={!sendingEmail}
            title="Email Preview"
          />
        </div>
      )}

      {/* Session Files Indicator */}
      {sessionFiles.length > 0 && (
        <div className="px-4 mb-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-green-800">
                📄 {sessionFiles.length} file{sessionFiles.length > 1 ? 's' : ''} uploaded for this session
              </span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 w-full px-4 pb-6 mt-auto">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about your uploaded files..."
          disabled={isLoading}
          className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-3 text-base shadow-sm focus:ring-2 focus:ring-yellow-200"
        />
        <input
          type="file"
          id="file-upload"
          accept=".txt,.csv,.pdf,.xlsx,.xls,.doc,.docx"
          onChange={(e) => {
            console.log('File input changed:', e.target.files);
            if (e.target.files && e.target.files.length > 0) {
              const file = e.target.files[0];
              console.log('Selected file:', file.name);
              
              // Handle different file types
              if (file.type === 'application/pdf') {
                console.log('PDF file detected - content extraction not available');
                handleFilesProcessed([{
                  id: Math.random().toString(),
                  name: file.name,
                  content: `[PDF file: ${file.name} - Content extraction not available in this session]`
                }]);
              } else if (file.type.includes('spreadsheet') || file.type.includes('excel') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                console.log('Excel file detected - content extraction not available');
                handleFilesProcessed([{
                  id: Math.random().toString(),
                  name: file.name,
                  content: `[Excel file: ${file.name} - Content extraction not available in this session]`
                }]);
              } else {
                // For text files (txt, csv, etc.)
                const reader = new FileReader();
                reader.onload = (event) => {
                  const content = event.target?.result as string;
                  console.log('File content loaded:', content.substring(0, 100) + '...');
                  handleFilesProcessed([{
                    id: Math.random().toString(),
                    name: file.name,
                    content: content
                  }]);
                };
                reader.readAsText(file);
              }
            }
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => {
            console.log('Upload button clicked');
            document.getElementById('file-upload')?.click();
          }}
          className="rounded-full bg-amber-400 hover:bg-amber-500 text-white px-3 py-3 shadow-sm"
          style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Upload className="h-5 w-5" />
        </button>
        <Button type="submit" disabled={isLoading} className="rounded-full bg-yellow-400 hover:bg-yellow-500 text-white px-5 py-3 shadow-sm">
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}

// Data Table Component for displaying data
function DataTable({ data, fields }: { data: Record<string, unknown>[]; fields?: string[] }) {
  // Ensure data is an array
  if (!Array.isArray(data)) {
    return <div>Invalid data format</div>;
  }

  if (!data || data.length === 0) {
    return <div>No data to display</div>;
  }

  // Ensure we have valid data
  const validData = data.filter(item => item && typeof item === 'object');
  if (validData.length === 0) {
    return <div>No valid data to display</div>;
  }

  const allColumns = Object.keys(validData[0]).filter(key => !['_id', '_creationTime', 'teamId', 'createdBy', 'sharedWith'].includes(key));
  const columns = fields && fields.length > 0 ? allColumns.filter(col => fields.includes(col)) : allColumns;

  return (
    <div
      style={{
        background: "#f9fafb",
        borderRadius: 16,
        padding: 16,
        overflowX: "auto",
        maxWidth: "100%",
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        marginTop: 8,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                  fontWeight: 600,
                  color: "#374151",
                  fontSize: "14px",
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {validData.slice(0, 10).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td
                  key={column}
                  style={{
                    padding: "12px",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: "14px",
                    color: "#6b7280",
                  }}
                >
                  {formatCellValue(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {validData.length > 10 && (
        <div style={{ textAlign: "center", padding: "12px", color: "#9ca3af", fontSize: "14px" }}>
          Showing 10 of {validData.length} records
        </div>
      )}
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  
  if (typeof value === "string") {
    return value;
  }
  
  if (typeof value === "number") {
    return value.toString();
  }
  
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  
  return String(value);
} 