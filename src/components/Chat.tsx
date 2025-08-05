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
  const [isInitializing, setIsInitializing] = useState(false);
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

  // Auto-create team for new users
  useEffect(() => {
    if (user && isLoaded) {
      checkAndCreateDefaultTeam();
    }
  }, [user, isLoaded]);

  const checkAndCreateDefaultTeam = async () => {
    if (!user) return;
    
    try {
      // First check if user already has teams
      const teamsResponse = await fetch('/api/teams');
      if (teamsResponse.ok) {
        const teams = await teamsResponse.json();
        if (teams && teams.length > 0) {
          console.log('✅ User already has teams, skipping default team creation');
          return;
        }
      }
      
      // Create default team if user has no teams
      console.log('Creating default team for user:', user.id);
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${user.firstName || user.username || 'My'}'s Team`,
        }),
      });
      
      if (response.ok) {
        const newTeam = await response.json();
        console.log('✅ Default team created successfully:', newTeam);
      } else {
        console.error('Failed to create default team:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error creating default team:', error);
    }
  };

  // Function to get initial message based on Google Workspace connection
  const getInitialMessage = async (): Promise<string> => {
    try {
      // Check Google Workspace connection status
      const response = await fetch("/api/test-token");
      const data = await response.json();
      
      if (data.hasToken) {
        // User has Google Workspace connected - get today's meetings
        try {
          const calendarResponse = await fetch("/api/calendar");
          const calendarData = await calendarResponse.json();
          
          if (calendarData.summary && !calendarData.summary.toLowerCase().includes("insufficient authentication")) {
            return `📅 Today's Schedule\n\n${calendarData.summary}\n\nI can help you analyze files, generate charts, and provide insights. Upload a file to get started!`;
          } else {
            return `Hello! I'm your AI assistant. I can see you have Google Workspace connected, but I need additional permissions to access your calendar. You can still upload files for analysis and chart generation. What would you like to do?`;
          }
        } catch (_error) {
          return `Hello! I'm your AI assistant. I can see you have Google Workspace connected. Upload a file and I'll help you analyze it, generate charts, and provide insights. What would you like to do?`;
        }
      } else {
        // User doesn't have Google Workspace connected - show integration instructions
        return `👋 Welcome to Shabe AI!\n\nI'm your AI assistant that can help you analyze files, generate charts, and provide insights.\n\nTo get the most out of your experience:\n\n1. Connect Google Workspace (optional but recommended)\n   • Go to Admin → Google Workspace Integration\n   • Connect your account for calendar access\n\n2. Upload files for analysis\n   • Use the upload button to add files\n   • I can analyze PDFs, Excel files, and more\n\n3. Ask me anything about your data\n   • Generate charts and insights\n   • Get summaries and recommendations\n\nWhat would you like to do first?`;
      }
    } catch (_error) {
      // Fallback message if connection check fails
      return "Hello! I'm your AI assistant. Upload a file and I'll help you analyze it, generate charts, and provide insights. What would you like to do?";
    }
  };

  // Initialize with dynamic welcome message if user is logged in
  useEffect(() => {
    if (user && isLoaded && messages.length === 0) {
      const initializeChat = async () => {
        setIsInitializing(true);
        const initialContent = await getInitialMessage();
        const welcomeMessage: Message = {
          id: Date.now().toString(),
        role: "assistant",
          content: initialContent,
        timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
        setIsInitializing(false);
      };
      
      initializeChat();
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
      // Get company data from localStorage
      const companyData = localStorage.getItem('companyData');
      const parsedCompanyData = companyData ? JSON.parse(companyData) : {
        name: "",
        website: "",
        description: ""
      };

      // Get real user data from Clerk
      const userData = {
        name: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}`
          : user.emailAddresses[0]?.emailAddress || "User",
        email: user.emailAddresses[0]?.emailAddress || "",
        company: parsedCompanyData.name || "Shabe ai"
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          userId: user.id,
          sessionFiles: sessionFiles,
          companyData: parsedCompanyData,
          userData: userData, // Pass real user data directly
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
              ? "bg-[#f3e89a] text-black"
              : "bg-[#d9d2c7]/10 text-black"
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
          
          {/* Render database table if present */}
          {message.data && message.data.displayFormat === 'table' && Array.isArray(message.data.records) && (
            <div className="mt-4">
              <DataTable data={message.data.records} fields={Object.keys(message.data.records[0] || {}).filter(key => key !== 'id')} />
            </div>
          )}
          
          {/* Render data table if present (legacy format) */}
          {message.data && Array.isArray(message.data) && message.data.length > 0 && !message.data.displayFormat && (
            <div className="mt-4">
              <DataTable data={message.data} fields={message.fields} />
            </div>
          )}
          
          {/* Render clarification question if present */}
          {message.needsClarification && message.clarificationQuestion && (
            <div className="mt-3 p-3 bg-[#f3e89a]/10 border border-[#f3e89a]/20 rounded-lg">
              <p className="text-black text-sm font-medium mb-2">🤔 I need clarification:</p>
              <p className="text-black text-sm">{message.clarificationQuestion}</p>
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
      <Card className="w-full max-w-4xl mx-auto border border-[#d9d2c7]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-black">
            <MessageSquare className="h-5 w-5 text-[#f3e89a]" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-[#d9d2c7]">
            Please sign in to access the AI assistant.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div style={{ width: '100%', background: '#fff' }} className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-6 pb-4" style={{ width: '100%' }}>
        {isInitializing ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-[#f3e89a]" />
              <span className="text-[#d9d2c7]">Loading your personalized experience...</span>
            </div>
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            
            {/* Loading indicator when preparing response */}
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-[#d9d2c7]/10 text-black">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-[#f3e89a] rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-[#f3e89a] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-[#f3e89a] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-[#d9d2c7]">Shabe ai is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
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
          <div className="bg-[#f3e89a]/10 border border-[#f3e89a]/20 rounded-lg p-3">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-[#f3e89a] mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-black">
                📄 {sessionFiles.length} file{sessionFiles.length > 1 ? 's' : ''} uploaded for this session
              </span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex w-full px-4 pb-6 mt-auto">
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
        <div className="flex w-full bg-white border border-[#d9d2c7] rounded-full shadow-sm focus-within:ring-2 focus-within:ring-[#f3e89a]">
          <button
            type="button"
            onClick={() => {
              console.log('Upload button clicked');
              document.getElementById('file-upload')?.click();
            }}
            className="bg-[#f3e89a] hover:bg-[#efe076] text-black rounded-l-full px-3 flex items-center justify-center"
            style={{ width: '48px' }}
          >
            <Upload className="h-5 w-5" />
          </button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
            placeholder={isLoading ? "Shabe ai is thinking..." : "Ask me anything about your uploaded files..."}
          disabled={isLoading}
            className="flex-1 border-0 focus:ring-0 px-4 py-3 text-base"
          />
          <Button type="submit" disabled={isLoading} className="bg-[#f3e89a] hover:bg-[#efe076] text-black rounded-r-full px-3 flex items-center justify-center" style={{ width: '48px' }}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
        </Button>
        </div>
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
        background: "white",
        borderRadius: 16,
        padding: 16,
        overflowX: "auto",
        maxWidth: "100%",
        border: "1px solid #d9d2c7",
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
                  borderBottom: "2px solid #d9d2c7",
                  fontWeight: 600,
                  color: "black",
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
                    borderBottom: "1px solid #d9d2c7",
                    fontSize: "14px",
                    color: "#d9d2c7",
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