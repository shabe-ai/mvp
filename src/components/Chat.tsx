"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
import EnhancedChartDisplay from "@/components/EnhancedChartDisplay";
import { logger } from "@/lib/logger";

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
  enhancedChart?: boolean;
  narrative?: string;
  // CRUD operation metadata
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  accountId?: string;
  accountName?: string;
  dealId?: string;
  dealName?: string;
  activityId?: string;
  activitySubject?: string;
  field?: string;
  value?: string;
  objectType?: string;
  details?: Record<string, string>;
  partialDetails?: Record<string, string>;
}

interface ChatProps {
  onAction?: (action: string, data?: unknown) => void;
}

export default function Chat({ onAction }: ChatProps = {}) {
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
  const [conversationContext, setConversationContext] = useState<any>(null);

  // Auto-create team for new users
  const checkAndCreateDefaultTeam = useCallback(async () => {
    if (!user) return;
    
    try {
      // First check if user already has teams
      const teamsResponse = await fetch('/api/teams');
      if (teamsResponse.ok) {
        const teams = await teamsResponse.json();
        if (teams && teams.length > 0) {
          logger.info('User already has teams, skipping default team creation', { userId: user.id });
          return;
        }
      }
      
      // Create default team if user has no teams
      logger.info('Creating default team for user', { userId: user.id });
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${user.firstName || user.username || 'My'}'s Team`,
        }),
      });
      
      if (response.ok) {
        const newTeam = await response.json();
        logger.info('Default team created successfully', { 
          teamId: newTeam._id,
          userId: user.id 
        });
      } else {
        logger.error('Failed to create default team', new Error(`HTTP ${response.status}: ${response.statusText}`), {
          userId: user.id,
          status: response.status,
          statusText: response.statusText
        });
      }
    } catch (error) {
      logger.error('Error creating default team', error instanceof Error ? error : new Error(String(error)), {
        userId: user.id
      });
    }
  }, [user]);

  useEffect(() => {
    if (user && isLoaded) {
      checkAndCreateDefaultTeam();
    }
  }, [user, isLoaded, checkAndCreateDefaultTeam]);

  // Function to get initial message based on Google Workspace connection
  const getInitialMessage = useCallback(async () => {
    try {
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
        } catch (error) {
          logger.error('Error fetching calendar data', error instanceof Error ? error : new Error(String(error)), {
            userId: user?.id
          });
          return `Hello! I'm your AI assistant. I can see you have Google Workspace connected. Upload a file and I'll help you analyze it, generate charts, and provide insights. What would you like to do?`;
        }
      } else {
        // User doesn't have Google Workspace connected - show integration instructions
        return `👋 Welcome to Shabe AI!\n\nI'm your AI assistant that can help you analyze files, generate charts, and provide insights.\n\nTo get the most out of your experience:\n\n1. Connect Google Workspace (optional but recommended)\n   • Go to Admin → Google Workspace Integration\n   • Connect your account for calendar access\n\n2. Upload files for analysis\n   • Use the upload button to add files\n   • I can analyze PDFs, Excel files, and more\n\n3. Ask me anything about your data\n   • Generate charts and insights\n   • Get summaries and recommendations\n\nWhat would you like to do first?`;
      }
    } catch (error) {
      logger.error('Error checking Google Workspace connection', error instanceof Error ? error : new Error(String(error)), {
        userId: user?.id
      });
      // Fallback message if connection check fails
      return "Hello! I'm your AI assistant. Upload a file and I'll help you analyze it, generate charts, and provide insights. What would you like to do?";
    }
  }, [user]);

  // Initialize with dynamic welcome message if user is logged in
  useEffect(() => {
    if (user && isLoaded && messages.length === 0) {
      const initializeChat = async () => {
        setIsInitializing(true);
        try {
          const initialContent = await getInitialMessage();
          const welcomeMessage: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: initialContent,
            timestamp: new Date(),
          };
          setMessages([welcomeMessage]);
        } catch (error) {
          logger.error('Error initializing chat', error instanceof Error ? error : new Error(String(error)), {
            userId: user.id
          });
          // Fallback message if initialization fails
          const fallbackMessage: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: "Hello! I'm your AI assistant. Upload a file and I'll help you analyze it, generate charts, and provide insights. What would you like to do?",
            timestamp: new Date(),
          };
          setMessages([fallbackMessage]);
        } finally {
          setIsInitializing(false);
        }
      };
      
      initializeChat();
    }
  }, [user, isLoaded, messages.length, getInitialMessage]);

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
          conversationContext: conversationContext, // Pass conversation context
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

        const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Debug: Log the entire response data
      console.log('Full response data:', JSON.stringify(data, null, 2));

      // Handle email draft response
      if (data.type === 'email_draft' && data.emailDraft) {
        console.log('Setting email draft:', {
          type: data.type,
          emailDraft: data.emailDraft,
          to: data.emailDraft.to,
          subject: data.emailDraft.subject,
          content: data.emailDraft.content
        });
        
        setEmailDraft({
          to: data.emailDraft.to,
          subject: data.emailDraft.subject,
          content: data.emailDraft.content,
          aiMessage: {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.content || data.message,
            timestamp: new Date(),
          },
          activityData: {}
        });
      } else {
        console.log('No email draft data:', {
          type: data.type,
          hasEmailDraft: !!data.emailDraft,
          emailDraft: data.emailDraft
        });
      }

      const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.content || data.message,
              timestamp: new Date(),
              action: data.action,
              data: data.data,
              needsClarification: data.needsClarification,
              clarificationQuestion: data.clarificationQuestion,
              fields: data.fields,
              chartSpec: data.chartSpec,
              enhancedChart: data.enhancedChart,
              narrative: data.narrative,
              // CRUD operation metadata
              contactId: data.contactId,
              contactName: data.contactName,
              contactEmail: data.contactEmail,
              accountId: data.accountId,
              accountName: data.accountName,
              dealId: data.dealId,
              dealName: data.dealName,
              activityId: data.activityId,
              activitySubject: data.activitySubject,
              field: data.field,
              value: data.value,
              objectType: data.objectType,
              details: data.details,
              partialDetails: data.partialDetails,
        };

        setMessages(prev => [...prev, assistantMessage]);

      // Store conversation context for next request
      if (data.conversationContext) {
        console.log('Storing conversation context from response:', data.conversationContext);
        setConversationContext(data.conversationContext);
      }

      // Notify parent of any actions that occurred
      if (data.action && onAction) {
        logger.info('Chat component calling onAction', { 
          action: data.action,
          userId: user.id 
        });
        onAction(data.action, {
          recordId: data.contactId || data.accountId || data.dealId,
          ...data
        });
      }

      // Handle email draft if present
      if (data.emailDraft) {
        setEmailDraft({
          to: data.emailDraft.to,
          subject: data.emailDraft.subject,
          content: data.emailDraft.content,
          aiMessage: assistantMessage,
          activityData: data.emailDraft.activityData || {}
        });
      }

    } catch (error) {
      logger.error("Error sending message", error instanceof Error ? error : new Error(String(error)), {
        userId: user.id,
        messageLength: input.length
      });
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error while processing your message. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailDraft || !user) return;
    
    setSendingEmail(true);
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: emailDraft.to,
          subject: emailDraft.subject,
          content: emailDraft.content,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Add success message
      const successMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `✅ Email sent successfully to ${emailDraft.to}!`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, successMessage]);
      
      // Clear email draft
      setEmailDraft(null);

    } catch (error) {
      logger.error("Error sending email", error instanceof Error ? error : new Error(String(error)), {
        userId: user.id,
        emailTo: emailDraft.to
      });
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error while sending the email. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleChartUpdate = async (newConfig: any) => {
    logger.info('Chart update requested', { 
      newConfig: JSON.stringify(newConfig),
      userId: user?.id 
    });
    
    // Add chart update message
    const updateMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: "I've updated the chart with your requested changes.",
      timestamp: new Date(),
      chartSpec: newConfig,
    };
    setMessages(prev => [...prev, updateMessage]);
  };

  const handleChartExport = async (format: string) => {
    try {
      logger.info('Chart export requested', { 
        format,
        userId: user?.id 
      });
      
      // Find the chart element to export
      const chartElement = document.querySelector('[data-chart-export]');
      if (!chartElement) {
        logger.error('Chart element not found for export', undefined, {
          format,
          userId: user?.id
        });
        return;
      }

      // Import html2canvas dynamically
      const html2canvas = (await import('html2canvas')).default;
      
      // Capture the chart as canvas
      const canvas = await html2canvas(chartElement as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        logging: false
      });

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob!);
        }, `image/${format}`, 0.9);
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chart-${Date.now()}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      logger.info('Chart exported successfully', { 
        format,
        fileName: link.download,
        userId: user?.id 
      });
      
      // Add export message
      const exportMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `I've exported the chart as ${format.toUpperCase()}.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, exportMessage]);
    } catch (error) {
      logger.error('Error exporting chart', error instanceof Error ? error : new Error(String(error)), {
        format,
        userId: user?.id
      });
      
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Sorry, I couldn't export the chart. Please try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleChartShare = async () => {
    logger.info('Chart share requested', { userId: user?.id });
    
    // Add share message
    const shareMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: "I've shared the chart with your team.",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, shareMessage]);
  };

  const handleInsightAction = async (insight: string) => {
    logger.info('Insight action requested', { 
      insight,
      userId: user?.id 
    });
    
    // Add insight action message
    const insightMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: `I've processed the insight: ${insight}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, insightMessage]);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    logger.info('Files processed', { 
      fileCount: fileArray.length,
      fileNames: fileArray.map(f => f.name),
      userId: user?.id 
    });

    const processedFiles: Array<{ id: string; name: string; content: string }> = [];

    for (const file of fileArray) {
      try {
        let content = '';
        
        if (file.type === 'text/plain' || file.type === 'text/csv') {
          content = await file.text();
        } else if (file.type === 'application/pdf') {
          logger.info('PDF file detected - content extraction not available', { 
            fileName: file.name,
            userId: user?.id 
          });
          content = `PDF file: ${file.name} (content extraction not available)`;
        } else if (file.type.includes('spreadsheet') || file.type.includes('excel')) {
          logger.info('Excel file detected - content extraction not available', { 
            fileName: file.name,
            userId: user?.id 
          });
          content = `Excel file: ${file.name} (content extraction not available)`;
        } else {
          content = await file.text();
        }

        logger.debug('File content loaded', { 
          fileName: file.name,
          contentLength: content.length,
          userId: user?.id 
        });

        processedFiles.push({
          id: Date.now().toString() + Math.random(),
          name: file.name,
          content: content.substring(0, 1000) // Limit content size
        });
      } catch (error) {
        logger.error('Error processing file', error instanceof Error ? error : new Error(String(error)), {
          fileName: file.name,
          userId: user?.id
        });
      }
    }

    setSessionFiles(prev => [...prev, ...processedFiles]);

    // Add file upload message
    const uploadMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: `I've processed ${processedFiles.length} file(s). You can now ask me questions about the content.`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, uploadMessage]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    logger.debug('File input changed', { 
      fileCount: e.target.files?.length || 0,
      userId: user?.id 
    });
    
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      logger.debug('Selected file', { 
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        userId: user?.id 
      });
      
      handleFileUpload(e.target.files);
    }
  };

  const handleUploadClick = () => {
    logger.debug('Upload button clicked', { userId: user?.id });
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.csv,.pdf,.xlsx,.xls';
    fileInput.multiple = true;
    fileInput.onchange = (e) => handleFileInputChange(e as any);
    fileInput.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* Chart Display */}
              {message.chartSpec && (
                <div className="mt-4">
                  {message.enhancedChart ? (
                    <EnhancedChartDisplay
                      chartSpec={{
                        ...message.chartSpec,
                        chartConfig: {
                          ...message.chartSpec.chartConfig,
                          margin: {
                            top: message.chartSpec.chartConfig?.margin?.top || 20,
                            right: message.chartSpec.chartConfig?.margin?.right || 30,
                            left: message.chartSpec.chartConfig?.margin?.left || 20,
                            bottom: message.chartSpec.chartConfig?.margin?.bottom || 60
                          }
                        }
                      }}
                      narrative={message.narrative}
                      onUpdate={handleChartUpdate}
                      onExport={handleChartExport}
                      onShare={handleChartShare}
                      onInsightAction={handleInsightAction}
                    />
                  ) : (
                    <ChartDisplay
                      chartSpec={{
                        ...message.chartSpec,
                        chartConfig: {
                          ...message.chartSpec.chartConfig,
                          margin: {
                            top: message.chartSpec.chartConfig?.margin?.top || 20,
                            right: message.chartSpec.chartConfig?.margin?.right || 30,
                            left: message.chartSpec.chartConfig?.margin?.left || 20,
                            bottom: message.chartSpec.chartConfig?.margin?.bottom || 60
                          }
                        }
                      }}
                      narrative={message.narrative}
                      onExport={handleChartExport}
                    />
                  )}
                </div>
              )}
              
              {/* Data Preview */}
              {message.data && (
                <div className="mt-4">
                  <PreviewCard
                    title="Data Preview"
                    initialData={{
                      title: "Data Preview",
                      content: JSON.stringify(message.data, null, 2)
                    }}
                    isEditable={false}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Email Draft Modal */}
      {emailDraft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Send Email</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">To:</label>
                <input
                  type="email"
                  value={emailDraft.to}
                  onChange={(e) => setEmailDraft(prev => prev ? {...prev, to: e.target.value} : null)}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject:</label>
                <input
                  type="text"
                  value={emailDraft.subject}
                  onChange={(e) => setEmailDraft(prev => prev ? {...prev, subject: e.target.value} : null)}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Content:</label>
                <textarea
                  value={emailDraft.content}
                  onChange={(e) => setEmailDraft(prev => prev ? {...prev, content: e.target.value} : null)}
                  className="w-full p-2 border rounded h-32"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                onClick={() => setEmailDraft(null)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={sendingEmail}
              >
                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Email"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Input Container */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Button
            type="button"
            onClick={handleUploadClick}
            className="bg-[#f3e89a] text-black hover:bg-[#efe076]"
            size="icon"
            disabled={isLoading}
          >
            <Upload className="h-4 w-4" />
          </Button>
          
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          
          <Button type="submit" disabled={isLoading || !input.trim()} className="bg-[#f3e89a] text-black hover:bg-[#efe076]">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
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