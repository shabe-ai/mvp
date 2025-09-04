"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { Button, Input } from "@/components/shabe-ui";

import { 
  Send, 
  MessageSquare,
  Loader2,
  Upload
} from "lucide-react";
import PreviewCard from "@/components/PreviewCard";
import ChartDisplay from "@/components/ChartDisplay";
import EnhancedChartDisplay from "@/components/EnhancedChartDisplay";
import CalendarPreviewModal from "@/components/CalendarPreviewModal";
import LinkedInPostPreviewModal from './LinkedInPostPreviewModal';
// Voice input hidden for v2 launch
// import VoiceInputButton from './VoiceInputButton';
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

export default function ChatWithVoice({ onAction }: ChatProps = {}) {
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
  const [calendarPreview, setCalendarPreview] = useState<{
    eventDetails: any;
    isVisible: boolean;
  } | null>(null);

  const [linkedinPostPreview, setLinkedInPostPreview] = useState<{
    postPreview: any;
    isVisible: boolean;
  } | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [sessionFiles, setSessionFiles] = useState<Array<{
    id: string;
    name: string;
    content: string;
  }>>([]);
  const [conversationContext, setConversationContext] = useState<any>(null);
  const [pendingEmailRecipient, setPendingEmailRecipient] = useState<string | null>(null);

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
            const firstName = user?.firstName || 'there';
            return `Hi ${firstName}! 👋\n\n📅 Today's Schedule\n\n${calendarData.summary}\n\nI can help you analyze files, generate charts, and provide insights. Upload a file to get started!`;
          } else {
            const firstName = user?.firstName || 'there';
            return `Hi ${firstName}! 👋\n\nYou have no meetings or events scheduled for today.\n\nI can see you have Google Workspace connected, but I need additional permissions to access your calendar. You can still upload files for analysis and chart generation. What would you like to do?`;
          }
        } catch (error) {
          logger.error('Error fetching calendar data', error instanceof Error ? error : new Error(String(error)), {
            userId: user?.id
          });
          const firstName = user?.firstName || 'there';
          return `Hi ${firstName}! 👋\n\nYou have no meetings or events scheduled for today.\n\nI can see you have Google Workspace connected. Upload a file and I'll help you analyze it, generate charts, and provide insights. What would you like to do?`;
        }
      } else {
        // User doesn't have Google Workspace connected - show integration instructions
        const firstName = user?.firstName || 'there';
        return `Hi ${firstName}! 👋\n\nYou have no meetings or events scheduled for today.\n\nI'm your AI assistant that can help you analyze files, generate charts, and provide insights.\n\nTo get the most out of your experience:\n\n1. Connect Google Workspace (optional but recommended)\n   • Go to Admin → Google Workspace Integration\n   • Connect your account for calendar access\n\n2. Upload files for analysis\n   • Use the upload button to add files\n   • I can analyze PDFs, Excel files, and more\n\n3. Ask me anything about your data\n   • Generate charts and insights\n   • Get summaries and recommendations\n\nWhat would you like to do first?`;
      }
    } catch (error) {
      logger.error('Error checking Google Workspace connection', error instanceof Error ? error : new Error(String(error)), {
        userId: user?.id
      });
      // Fallback message if connection check fails
      const firstName = user?.firstName || 'there';
      return `Hi ${firstName}! 👋\n\nYou have no meetings or events scheduled for today.\n\nI'm your AI assistant. Upload a file and I'll help you analyze it, generate charts, and provide insights. What would you like to do?`;
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
          const firstName = user?.firstName || 'there';
          const fallbackMessage: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: `Hi ${firstName}! 👋\n\nYou have no meetings or events scheduled for today.\n\nI'm your AI assistant. Upload a file and I'll help you analyze it, generate charts, and provide insights. What would you like to do?`,
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

      // Handle email draft response - Enhanced detection logic
      const isEmailDraft = data.type === 'email_draft' || 
                          data.finalType === 'email_draft' || 
                          data.hasEmailDraft ||
                          (data.emailDraftTo && data.emailDraftSubject) ||
                          (data.emailDraft && data.emailDraft.to && data.emailDraft.subject);
      
      console.log('📧📧📧 EMAIL DRAFT DETECTION RESULT:', {
        isEmailDraft,
        type: data.type,
        finalType: data.finalType,
        hasEmailDraft: data.hasEmailDraft,
        hasEmailDraftTo: !!data.emailDraftTo,
        hasEmailDraftSubject: !!data.emailDraftSubject,
        hasEmailDraftObject: !!(data.emailDraft && data.emailDraft.to && data.emailDraft.subject)
      });

      if (isEmailDraft) {
        // Handle both nested and top-level email draft formats
        const emailDraftData = data.emailDraft || {
          to: data.emailDraftTo,
          subject: data.emailDraftSubject,
          content: data.emailDraftContent || data.message || data.content
        };
        
        if (emailDraftData.to && emailDraftData.subject) {
          console.log('Setting email draft:', {
            type: data.type,
            emailDraftData,
            to: emailDraftData.to,
            subject: emailDraftData.subject,
            content: emailDraftData.content
          });
          
          setEmailDraft({
            to: emailDraftData.to,
            subject: emailDraftData.subject,
            content: emailDraftData.content,
            aiMessage: {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.content || data.message,
              timestamp: new Date(),
            },
            activityData: {}
          });
        } else {
          console.log('Email draft data incomplete:', {
            type: data.type,
            emailDraftData,
            hasTo: !!emailDraftData.to,
            hasSubject: !!emailDraftData.subject,
            hasContent: !!emailDraftData.content
          });
        }
      } else {
        console.log('No email draft data:', {
          type: data.type,
          hasEmailDraft: !!data.emailDraft,
          emailDraft: data.emailDraft
        });
      }

      // Handle LinkedIn post preview
      if (data.type === 'linkedin_post_preview') {
        console.log('Setting LinkedIn post preview:', data.content);
        console.log('Full data object:', data);
        
        // Ensure we have the correct structure
        const postPreview = data.content || data.postPreview || data;
        
        if (postPreview && typeof postPreview === 'object') {
          setLinkedInPostPreview({
            postPreview: postPreview,
            isVisible: true
          });
        } else {
          console.error('Invalid LinkedIn post preview data:', postPreview);
          // Fallback to error message
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "I encountered an issue while creating your LinkedIn post preview. Please try again.",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      }

      const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.type === 'linkedin_post_preview' ? data.message : (data.content || data.message),
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

      // Handle calendar preview if present
      console.log('Checking for calendar preview:', {
        type: data.type,
        hasEventPreview: !!data.eventPreview,
        eventPreview: data.eventPreview
      });
      
      if (data.type === 'calendar_preview' && data.eventPreview) {
        console.log('Setting calendar preview:', data.eventPreview);
        setCalendarPreview({
          eventDetails: data.eventPreview,
          isVisible: true
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

  // Voice input hidden for v2 launch
  // const handleVoiceTranscript = (transcript: string) => {
  //   if (transcript.trim()) {
  //     setInput(transcript);
  //     // Auto-submit the voice input
  //     setTimeout(() => {
  //       const formEvent = new Event('submit', { bubbles: true, cancelable: true });
  //       const form = document.querySelector('form );
  //       if (form) {
  //         form.dispatchEvent(formEvent);
  //       }
  //     }, 100);
  //   }
  // };

  const handleUploadClick = () => {
    logger.debug('Upload button clicked', { userId: user?.id });
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.csv,.pdf,.xlsx,.xls';
    fileInput.multiple = true;
    fileInput.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        // Handle file upload logic here
        console.log('Files selected:', files);
      }
    };
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
              className={`max-w-[80%] rounded-xl p-3 ${
                message.role === "user"
                  ? "bg-gray-100 text-gray-800"
                  : "bg-yellow-50 text-gray-800"
              }`}
            >
              <div className="whitespace-pre-wrap font-body">{message.content}</div>
              
              {/* Chart Display */}
              {message.chartSpec && (
                <div className="mt-3">
                  {message.enhancedChart ? (
                    <EnhancedChartDisplay
                      chartSpec={{
                        ...message.chartSpec,
                        chartConfig: {
                          ...message.chartSpec.chartConfig,
                          margin: message.chartSpec.chartConfig?.margin as { top: number; right: number; bottom: number; left: number } || {
                            top: 20,
                            right: 30,
                            bottom: 60,
                            left: 20
                          }
                        }
                      }}
                      narrative={message.narrative}
                    />
                  ) : (
                    <ChartDisplay 
                      chartSpec={{
                        ...message.chartSpec,
                        chartConfig: {
                          ...message.chartSpec.chartConfig,
                          margin: message.chartSpec.chartConfig?.margin as { top: number; right: number; bottom: number; left: number } || {
                            top: 20,
                            right: 30,
                            bottom: 60,
                            left: 20
                          }
                        }
                      }}
                    />
                  )}
                </div>
              )}
              
              {/* Timestamp */}
              <div className="text-xs opacity-70 mt-1 font-body">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-yellow-50 text-gray-800 rounded-xl p-3">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-body">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Email Draft Modal */}
      {emailDraft && (() => {
        console.log('🎯🎯🎯 RENDERING EMAIL DRAFT MODAL WITH DATA - LATEST VERSION:', emailDraft);
        console.log('🎯🎯🎯 MODAL RENDERING CONDITIONS:', {
          hasEmailDraft: !!emailDraft,
          emailDraftTo: emailDraft?.to,
          emailDraftSubject: emailDraft?.subject,
          emailDraftContent: emailDraft?.content?.substring(0, 100) + '...'
        });
        return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 border-2 border-gray-300 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4 font-heading text-black">Email Preview</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 font-body text-black">To:</label>
                <input
                  value={emailDraft.to}
                  onChange={(e) => setEmailDraft(prev => prev ? {...prev, to: e.target.value} : null)}
                  className="w-full p-2 border border-gray-300 rounded-md font-body text-black bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 font-body text-black">Subject:</label>
                <input
                  value={emailDraft.subject}
                  onChange={(e) => setEmailDraft(prev => prev ? {...prev, subject: e.target.value} : null)}
                  className="w-full p-2 border border-gray-300 rounded-md font-body text-black bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 font-body text-black">Content:</label>
                <textarea
                  value={emailDraft.content}
                  onChange={(e) => setEmailDraft(prev => prev ? {...prev, content: e.target.value} : null)}
                  className="w-full p-2 border border-gray-300 rounded-md h-32 font-body text-black bg-white"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                onClick={() => setEmailDraft(null)}
                variant="subtle"
                className="font-button"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="font-button"
              >
                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Email"}
              </Button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Input Container */}
      <div className="border-t border-line-200 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Button
            type="button"
            onClick={handleUploadClick}
            className="bg-accent-primary text-text-on-accent-primary hover:bg-accent-primary-hover"
            size="sm"
            disabled={isLoading}
          >
            <Upload className="h-4 w-4" />
          </Button>
          
          <Input
            placeholder="Type your message or use voice input..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="font-body"
          />
          
          {/* Voice button hidden for v2 launch
          <VoiceInputButton
            onTranscript={handleVoiceTranscript}
            disabled={isLoading}
          />
          */}
          
          <Button type="submit" disabled={isLoading || !input.trim()} className="bg-accent-primary text-text-on-accent-primary hover:bg-accent-primary-hover">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
      </div>
    </div>
  );
}
