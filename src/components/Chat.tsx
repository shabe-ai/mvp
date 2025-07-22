"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Send, 
  Plus, 
  Mail, 
  Phone, 
  Building, 
  Users, 
  Calendar,
  TrendingUp,
  MessageSquare,
  Loader2
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  action?: string;
  data?: Record<string, unknown>;
  needsClarification?: boolean;
  clarificationQuestion?: string;
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

  // Initialize with welcome message
  useEffect(() => {
    if (user && !messages.length) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `Welcome to your CRM! 👋 I'm here to help you manage your customer relationships. You can:

• Create contacts, accounts, activities, and deals
• View and search your data
• Update records
• Add custom fields
• Get insights and reports

What would you like to do today?`,
        timestamp: new Date(),
      }]);
    }
  }, [user, messages.length]);

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
      const response = await fetch(`/api/teams?userId=${user.id}`, {
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
          ownerId: user.id,
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
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Chat API response:", JSON.stringify(data, null, 2));
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
          action: data.action,
          data: data.data,
          needsClarification: data.needsClarification,
          clarificationQuestion: data.clarificationQuestion,
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
    
    return (
      <div
        key={message.id}
        className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
      >
        <div
          className={`max-w-[80%] rounded-lg px-4 py-2 shadow-md ${
            isUser
              ? "bg-blue-500 text-white"
              : "bg-white"
          }`}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
          
          {message.needsClarification && message.clarificationQuestion && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border-l-4 border-yellow-400">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                🤔 {message.clarificationQuestion}
              </p>
            </div>
          )}
          
          {message.action === "read" && message.data && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-2">
                Debug: Data type: {typeof message.data}, Is array: {Array.isArray(message.data)}, Length: {Array.isArray(message.data) ? message.data.length : 'N/A'}
              </div>
              <DataTable data={Array.isArray(message.data) ? message.data as Record<string, unknown>[] : []} />
            </div>
          )}
        </div>
      </div>
    );
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

  return (
    <div className="flex flex-col flex-1 w-full h-full justify-end shadow-2xl rounded-2xl bg-yellow-50 max-w-2xl mx-auto my-12 p-10">
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
      <div className="flex-1 w-full flex flex-col justify-end">
        <div className="flex-1 w-full flex flex-col justify-end">
          <ScrollArea className="flex-1 w-full mb-4 px-0">
            <div className="space-y-4 w-full max-w-2xl mx-auto">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 shadow-md ${
                        isUser
                          ? "bg-blue-500 text-white"
                          : "bg-white"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      {message.needsClarification && message.clarificationQuestion && (
                        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border-l-4 border-yellow-400">
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            🤔 {message.clarificationQuestion}
                          </p>
                        </div>
                      )}
                      {message.action === "read" && message.data && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-500 mb-2">
                            Debug: Data type: {typeof message.data}, Is array: {Array.isArray(message.data)}, Length: {Array.isArray(message.data) ? message.data.length : 'N/A'}
                          </div>
                          <DataTable data={Array.isArray(message.data) ? message.data as Record<string, unknown>[] : []} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm text-gray-500">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-2xl mx-auto pb-6">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={currentTeam ? "Ask me anything about your CRM..." : "Loading team..."}
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
    </div>
  );
}

// Data Table Component for displaying CRM data
function DataTable({ data }: { data: Record<string, unknown>[] }) {
  // Ensure data is an array
  if (!Array.isArray(data)) {
    return <div className="text-gray-500 text-sm">Invalid data format</div>;
  }

  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-sm">No data to display</div>;
  }

  // Ensure we have valid data
  const validData = data.filter(item => item && typeof item === 'object');
  if (validData.length === 0) {
    return <div className="text-gray-500 text-sm">No valid data to display</div>;
  }

  const columns = Object.keys(validData[0]).filter(key => 
    !['_id', '_creationTime', 'teamId', 'createdBy', 'sharedWith'].includes(key)
  );

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b">
            {columns.map(column => (
              <th key={column} className="text-left p-3 font-medium text-gray-700 dark:text-gray-300">
                {column.charAt(0).toUpperCase() + column.slice(1).replace(/([A-Z])/g, ' $1')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {validData.map((row, index) => (
            <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
              {columns.map(column => (
                <td key={column} className="p-3 text-gray-600 dark:text-gray-400">
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