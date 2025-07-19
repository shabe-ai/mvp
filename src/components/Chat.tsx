"use client";

import React, { useState } from "react";
import PreviewCard from "./PreviewCard";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type PreviewData = {
  title: string;
  content: string;
  subject?: string;
  action?: "send_email" | "create_event" | "ask_report";
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setIsLoading(true);
    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
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
          setPreviewData({
            title: parsedReply.title || "Action Preview",
            content: parsedReply.content || assistantReply,
            subject: parsedReply.subject,
            action: parsedReply.action,
          });
          // Store the original user message for email extraction
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
    // Handle the preview action (send email, create event, etc.)
    console.log("Sending action:", data);
    
    try {
      // Extract email address from the stored original user message
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
    } catch (error) {
      console.error("Error sending email:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Failed to send email. Please try again." }
      ]);
    }
  };

  const handlePreviewEdit = (data: PreviewCardData) => {
    setPreviewData({
      title: data.title,
      content: data.content,
      subject: data.subject,
      action: previewData?.action,
    });
  };

  const handlePreviewCancel = () => {
    setPreviewData(null);
  };

  return { 
    messages, 
    input, 
    setInput, 
    sendMessage, 
    isLoading,
    previewData,
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
    sendMessage, 
    isLoading,
    previewData,
    handlePreviewSend,
    handlePreviewEdit,
    handlePreviewCancel,
  } = useSimpleChat();

  return (
    <div className="flex flex-col h-[80vh] max-w-4xl mx-auto">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-4 p-4 border rounded-lg bg-white shadow">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded-lg max-w-xs ${m.role === "user" ? "bg-blue-100 self-end ml-auto" : "bg-gray-100 self-start mr-auto"}`}
          >
            {m.content}
          </div>
        ))}
      </div>

      {/* Preview Card */}
      {previewData && (
        <div className="mb-4">
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

      {/* Chat Input */}
      <form onSubmit={sendMessage} className="flex gap-2 p-4 border rounded-lg bg-white shadow">
        <input
          className="flex-1 border rounded px-3 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
} 