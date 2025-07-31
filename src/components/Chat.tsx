"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { 
  Send, 
  Plus, 
  Building, 
  MessageSquare,
  Loader2
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

interface Team {
  _id: string;
  id?: string;
  name: string;
  ownerId: string;
  members: string[];
}

export default function Chat({ hideTeamSelector = false }: { hideTeamSelector?: boolean }) {
  const { user, isLoaded } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [emailDraft, setEmailDraft] = useState<{
    to: string;
    subject: string;
    content: string;
    aiMessage: Message;
    activityData: Record<string, unknown>;
  } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);


  // Initialize with calendar summary if user is logged in
  useEffect(() => {
    if (user && isLoaded) {
      (async () => {
        try {
          const res = await fetch('/api/calendar');
          const data = await res.json();
          let content = data.summary;
          if (data.events && data.events.length > 0) {
            content += '\n\n';
            data.events.forEach((event: Record<string, unknown>) => {
              const start = (event.start as Record<string, unknown>)?.dateTime || (event.start as Record<string, unknown>)?.date || '';
              const time = start ? new Date(start as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              content += `• ${event.summary || 'Untitled Event'}${time ? ` at ${time}` : ''}`;
              if (event.attendees && Array.isArray(event.attendees) && event.attendees.length > 0) {
                content += ` (Attendees: ${(event.attendees as Record<string, unknown>[]).map((a: Record<string, unknown>) => a.email).join(', ')})`;
              }
              content += '\n';
            });
            content += '\nWould you like help prepping for any of these meetings?';
          }
          setMessages([{
            id: 'calendar-summary',
            role: 'assistant',
            content,
            timestamp: new Date(),
          }]);
        } catch {
          setMessages([{
            id: 'calendar-summary',
            role: 'assistant',
            content: 'Welcome! (Could not fetch your calendar events.)',
            timestamp: new Date(),
          }]);
        }
      })();
    }
  }, [user, isLoaded]);

  // Load messages from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("shabe_chat_messages");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      } catch {}
    }
    // If no stored messages, show welcome
    if (user && !messages.length) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `Welcome to your CRM! 👋 I'm here to help you manage your customer relationships. You can:\n\n• Create contacts, accounts, activities, and deals\n• View and search your data\n• Update records\n• Add custom fields\n• Get insights and reports\n\nWhat would you like to do today?`,
        timestamp: new Date(),
      }]);
    }
  }, [user]);

  // Save messages to localStorage after every update
  useEffect(() => {
    localStorage.setItem("shabe_chat_messages", JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load user's teams
  useEffect(() => {
    if (user) {
      console.log('User authenticated:', user.id, user.firstName);
      loadUserTeams();
    } else {
      console.log('No user authenticated');
    }
  }, [user]);

  const loadUserTeams = async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/teams', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const userTeams = await response.json();
        setTeams(userTeams);
        
        // Set first team as current, or create default team
        if (userTeams.length > 0) {
          setCurrentTeam(userTeams[0]);
        } else {
          // Create default team for user
          await createDefaultTeam();
        }
      } else {
        // If no teams found, create default team
        await createDefaultTeam();
      }
    } catch (error) {
      console.error('Error loading teams:', error);
      // If error, try to create default team
      await createDefaultTeam();
    }
  };

  const createDefaultTeam = async () => {
    if (!user) return;
    
    try {
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
        console.log('Created team:', newTeam);
        console.log('Setting current team to:', newTeam.id);
        setCurrentTeam(newTeam);
        setTeams([newTeam]);
        console.log('Team state updated');
      } else {
        console.error('Failed to create team:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error creating default team:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    
    // If no team is selected, try to create one first
    if (!currentTeam) {
      console.log('No team selected, creating default team...');
      await createDefaultTeam();
      
      // Wait a moment for the team to be set, then retry
      setTimeout(() => {
        if (currentTeam) {
          handleSubmit(e);
        }
      }, 1000);
      return; // Don't send message yet, let the team creation complete
    }

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
      console.log("Current team state:", currentTeam);
      console.log("Current team ID:", currentTeam?._id);
      if (!currentTeam) {
        console.log("No team available, cannot send message");
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Please wait while I set up your team...",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        return;
      }

      const requestBody = {
        messages: [...messages, userMessage].map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        userId: user.id,
        teamId: currentTeam._id,
      };
      
      console.log("Team ID being sent:", currentTeam._id);
      console.log("Sending to chat API:", JSON.stringify(requestBody, null, 2));
      
      // If the user input looks like an email send request, add draftOnly: true
      let draftOnly = false;
      if (input.toLowerCase().includes("send email") || input.toLowerCase().includes("email")) {
        draftOnly = true;
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestBody, draftOnly }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Full response from /api/chat", data);
        if (data) {
          console.log("DEBUG: data.action", data.action, "data.objectType", data.objectType, "data.data", data.data);
        }
        // If the AI wants to create an email activity, show preview and do NOT create the activity yet
        if (
          data.action === "create" &&
          data.data &&
          data.data.type === "email" &&
          data.data.subject &&
          (data.data.content || data.data.description || data.data.body)
        ) {
          // Extract email details from data
          const to = data.data.to || data.data.email || "";
          const subject = data.data.subject || "";
          const content = data.data.content || data.data.body || data.data.description || "";
          console.log("Setting emailDraft", data.data);
          setEmailDraft({
            to,
            subject,
            content,
            aiMessage: {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.message,
              timestamp: new Date(),
              action: data.action,
              data: data.data,
              needsClarification: data.needsClarification,
              clarificationQuestion: data.clarificationQuestion,
            },
            activityData: data.data,
          });
          setIsLoading(false);
          return; // Do NOT add the assistant message to the chat
        }

        // Intercept delete contact actions to resolve contactId if needed
        if (
          data.action === "delete" &&
          data.objectType === "contacts" &&
          data.data &&
          !data.data.contactId &&
          currentTeam
        ) {
          console.debug("[Delete Intercept] Running for delete action", data.data);
          // Fetch all contacts for the team
          const contactsRes = await fetch(`/api/contacts?teamId=${currentTeam._id}`);
          const contacts: Record<string, unknown>[] = await contactsRes.json();

          let matches = contacts;

          // Apply filters if present
          if (data.data.company !== undefined) {
            matches = matches.filter((c) => c.company === data.data.company);
          }
          if (data.data.firstName) {
            matches = matches.filter((c) => c.firstName === data.data.firstName);
          }
          if (data.data.lastName) {
            matches = matches.filter((c) => c.lastName === data.data.lastName);
          }
          if (data.data.contactName) {
            // Robustly split and match contactName
            const nameParts = String(data.data.contactName).trim().split(/\s+/);
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
            matches = matches.filter((c) =>
              typeof c.firstName === 'string' &&
              typeof c.lastName === 'string' &&
              (
                (firstName && c.firstName.toLowerCase() === firstName.toLowerCase()) ||
                (lastName && c.lastName.toLowerCase() === lastName.toLowerCase())
              )
            );
          }

          // If no filter at all, and only one contact exists, match it
          if (
            Object.keys(data.data).length === 0 &&
            contacts.length === 1 &&
            contacts[0]._id
          ) {
            console.debug("[Delete Intercept] Only one contact exists, auto-deleting", contacts[0]);
            matches = [contacts[0]];
          }

          // If no filter and multiple contacts, prompt for clarification
          if (
            Object.keys(data.data).length === 0 &&
            contacts.length > 1
          ) {
            console.debug("[Delete Intercept] Multiple contacts, need clarification");
            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `❌ Multiple contacts found. Please specify which one to delete.`,
              timestamp: new Date(),
            }]);
            setIsLoading(false);
            return;
          }

          if (matches.length === 1 && matches[0]._id) {
            // Send delete with contactId
            console.debug("[Delete Intercept] Deleting contact with id", matches[0]._id);
            const deleteRes = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [...messages, userMessage],
                userId: user.id,
                teamId: currentTeam._id,
                action: "delete",
                objectType: "contacts",
                data: { contactId: matches[0]._id },
              }),
            });
            const deleteData = await deleteRes.json();
            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: typeof deleteData.message === 'string' ? deleteData.message : (deleteData.message?.message || JSON.stringify(deleteData.message)),
              timestamp: new Date(),
            }]);
            setIsLoading(false);
            return;
          } else if (matches.length > 1) {
            console.debug("[Delete Intercept] Multiple contacts match filter, need clarification");
            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `❌ Multiple contacts found matching your request. Please specify which one to delete.`,
              timestamp: new Date(),
            }]);
            setIsLoading(false);
            return;
          } else {
            console.debug("[Delete Intercept] No contact found matching request");
            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `❌ No contact found matching your request to delete.`,
              timestamp: new Date(),
            }]);
            setIsLoading(false);
            return;
          }
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: typeof data.message === 'string' ? data.message : JSON.stringify(data.message),
          timestamp: new Date(),
          action: data.action,
          data: data.data,
          needsClarification: data.needsClarification,
          clarificationQuestion: data.clarificationQuestion,
          ...(data.fields ? { fields: data.fields } : {}),
          ...(data.chartSpec ? { chartSpec: data.chartSpec } : {}),
          ...(data.narrative ? { narrative: data.narrative } : {}),
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error("Failed to get response");
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

  const handleQuickAction = (action: string) => {
    const actionMessages = {
      "create_contact": "Create a new contact",
      "create_account": "Create a new account/company",
      "create_deal": "Create a new sales deal",
      "create_activity": "Schedule an activity (call, meeting, email)",
      "view_contacts": "Show me all contacts",
      "view_accounts": "Show me all accounts",
      "view_deals": "Show me all deals",
      "view_activities": "Show me all activities",
    };

    setInput(actionMessages[action as keyof typeof actionMessages] || action);
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === "user";
    // System messages are assistant messages that are informational (not responses to user queries)
    const isSystem = message.role === 'assistant' && (
      message.action === 'message' || 
      (!message.action && !message.data) ||
      message.content.includes('meeting') && message.content.includes('today') ||
      message.content.startsWith('❌') || // Error messages
      message.content.startsWith('✅') || // Success messages
      message.content.startsWith('📊') || // Data messages
      message.content.startsWith('📭') || // No data messages
      message.content.startsWith('📄')    // Document messages
    );
    return (
      <div
        key={message.id}
        style={{
          display: "flex",
          justifyContent: isUser ? "flex-end" : "flex-start",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            maxWidth: "75%",
            borderRadius: 16,
            padding: "12px 18px",
            background: isSystem ? "#f8f9fa" : (isUser ? "#fde047" : "#fff"),
            color: "#222",
            fontWeight: 400,
            boxShadow: isSystem ? "0 6px 20px rgba(0,0,0,0.15)" : (isUser ? "0 4px 16px rgba(0,0,0,0.10)" : "0 1px 4px rgba(0,0,0,0.04)"),
            whiteSpace: "pre-wrap",
            border: isSystem ? "1px solid #e9ecef" : "none",
          }}
        >
          {message.content}
          {message.role === "assistant" && message.action === "read" && message.data && (
            <div style={{ marginTop: 12, background: "#fff", borderRadius: 12, padding: 8 }}>
              <DataTable
                data={Array.isArray(message.data) ? message.data as Record<string, unknown>[] : message.data ? [message.data as Record<string, unknown>] : []}
                fields={Array.isArray(message.fields) ? message.fields : undefined}
              />
            </div>
          )}
          {message.role === "assistant" && message.action === "chart" && message.chartSpec && (
            <div style={{ marginTop: 12 }}>
              <ChartDisplay
                chartSpec={message.chartSpec}
                narrative={message.narrative}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  // Handle sending email after preview
  const handleSendEmail = async (draft: { to: string; subject: string; content: string }) => {
    if (!emailDraft) return;
    setSendingEmail(true);
    try {
      let recipientEmail = draft.to;
      if (!recipientEmail && emailDraft.activityData && currentTeam) {
        const contactName = (emailDraft.activityData as Record<string, unknown>).contactName as string | undefined;
        const contactEmail = (emailDraft.activityData as Record<string, unknown>).email as string | undefined;
        const contactsRes = await fetch(`/api/contacts?teamId=${currentTeam._id}`);
        const contacts: Record<string, unknown>[] = await contactsRes.json();
        let found: Record<string, unknown> | undefined;
        if (contactEmail) {
          found = contacts.find((c) => typeof c.email === 'string' && c.email.toLowerCase() === contactEmail.toLowerCase());
        }
        if (!found && contactName) {
          const nameParts = contactName.split(" ");
          if (nameParts.length > 1) {
            const [firstName, ...rest] = nameParts;
            const lastName = rest.join(" ");
            found = contacts.find((c) =>
              typeof c.firstName === 'string' && typeof c.lastName === 'string' &&
              c.firstName.toLowerCase() === firstName.toLowerCase() &&
              c.lastName.toLowerCase() === lastName.toLowerCase()
            );
          } else {
            // Try to match by first OR last name
            found = contacts.find((c) =>
              (typeof c.firstName === 'string' && c.firstName.toLowerCase() === contactName.toLowerCase()) ||
              (typeof c.lastName === 'string' && c.lastName.toLowerCase() === contactName.toLowerCase())
            );
          }
        }
        if (found && typeof found.email === 'string') {
          recipientEmail = found.email;
        } else {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `❌ Could not find email for contact: ${contactName || contactEmail || "(unknown)"}`,
            timestamp: new Date(),
          }]);
          setEmailDraft(null);
          setSendingEmail(false);
          return;
        }
      }
      if (!recipientEmail) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `❌ No recipient email provided or found.`,
          timestamp: new Date(),
        }]);
        setEmailDraft(null);
        setSendingEmail(false);
        return;
      }
      // Send the email
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmail,
          subject: draft.subject,
          content: draft.content,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `❌ Failed to send email: ${result.message}`,
          timestamp: new Date(),
        }]);
        setEmailDraft(null);
        setSendingEmail(false);
        return;
      }
      // After email is sent, create the activity in the DB directly
      if (!user) throw new Error("User not authenticated");
      const activityRes = await fetch("/api/log-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: currentTeam?._id,
          createdBy: user.id,
          type: "email",
          subject: draft.subject,
          description: draft.content,
          contactId: (emailDraft.activityData as Record<string, unknown>).contactId,
          accountId: (emailDraft.activityData as Record<string, unknown>).accountId,
          dealId: (emailDraft.activityData as Record<string, unknown>).dealId,
          status: (emailDraft.activityData as Record<string, unknown>).status || "scheduled",
          startTime: (emailDraft.activityData as Record<string, unknown>).startTime,
          endTime: (emailDraft.activityData as Record<string, unknown>).endTime,
          attendees: (emailDraft.activityData as Record<string, unknown>).attendees,
          customFields: (emailDraft.activityData as Record<string, unknown>).customFields,
        }),
      });
      const activityResult = await activityRes.json();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `✅ Email sent and activity logged!`,
        timestamp: new Date(),
      }]);
      setEmailDraft(null);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `❌ Error sending email: ${err}`,
        timestamp: new Date(),
      }]);
      setEmailDraft(null);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCancelEmail = () => {
    setEmailDraft(null);
  };



  // Show loading state while Clerk is determining authentication
  if (!isLoaded) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            CRM Assistant
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
            CRM Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500">
            Please sign in to access your CRM.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Add debug log before rendering messages
  console.debug('DEBUG: Rendering messages array:', messages);
  return (
    <div style={{ width: '100%', background: '#fff' }} className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-6 pb-4" style={{ width: '100%' }}>
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>
      {/* Team Selector */}
      {!hideTeamSelector && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                {currentTeam?.name || "Select Team"}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTeamSelector(!showTeamSelector)}
              >
                {teams.length > 1 ? "Switch Team" : "Create Team"}
              </Button>
            </div>
          </CardHeader>
          
          {showTeamSelector && (
            <CardContent className="pt-0">
              <div className="space-y-2">
                {teams.map(team => (
                  <div
                    key={team.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      currentTeam?.id === team.id
                        ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                    onClick={() => {
                      setCurrentTeam(team);
                      setShowTeamSelector(false);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{team.name}</span>
                      {team.ownerId === user.id && (
                        <Badge variant="secondary" className="text-xs">
                          Owner
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={createDefaultTeam}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Team
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Chat Interface */}
      {(() => { if (emailDraft) { console.log("Rendering PreviewCard", emailDraft); } return null; })()}
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





      {/* Document Context Indicator */}
      {currentTeam && (
        <div className="px-4 mb-2">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-blue-800">
                💡 AI has access to your team&apos;s processed documents. Ask questions about your files!
              </span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 w-full px-4 pb-6 mt-auto">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={currentTeam ? "Ask me anything about your CRM or documents..." : "Loading team..."}
          disabled={isLoading}
          className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-3 text-base shadow-sm focus:ring-2 focus:ring-yellow-200"
        />
        <Button type="submit" disabled={isLoading} className="rounded-full bg-yellow-400 hover:bg-yellow-500 text-white px-5 py-3 shadow-sm">
          <Send className="h-5 w-5" />
        </Button>
      </form>
      {/* Debug info (optional, can be removed for production) */}
      {/* <div className="mt-2 text-xs text-gray-500 text-center">
        User: {user?.id || 'None'} | Team: {currentTeam?.name || 'None'} | Teams: {teams.length}
      </div> */}
    </div>
  );
}

// Data Table Component for displaying CRM data
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
      <table style={{ minWidth: 600, width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
        <thead style={{ background: "#fde047", borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <tr style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            {columns.map((column, idx) => (
              <th
                key={column}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  fontWeight: 600,
                  color: "#222",
                  ...(idx === 0 ? { borderTopLeftRadius: 16 } : {}),
                  ...(idx === columns.length - 1 ? { borderTopRightRadius: 16 } : {}),
                }}
              >
                {column.charAt(0).toUpperCase() + column.slice(1).replace(/([A-Z])/g, ' $1')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {validData.map((row, index) => (
            <tr key={index}>
              {columns.map(column => (
                <td key={column} style={{ padding: "8px 12px", color: "#374151" }}>
                  {formatCellValue(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  
  // Handle empty objects
  if (typeof value === "object") {
    if (Object.keys(value as object).length === 0) return "-";
    return JSON.stringify(value);
  }
  
  if (typeof value === "boolean") return value ? "Yes" : "No";
  
  if (typeof value === "number") {
    // Check if it's a timestamp
    if (value > 1000000000000) {
      return new Date(value).toLocaleDateString();
    }
    return value.toString();
  }
  
  return String(value);
} 