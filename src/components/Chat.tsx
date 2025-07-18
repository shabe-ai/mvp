"use client";

import React, { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function useSimpleChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setIsLoading(true);
    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });
      if (response.ok) {
        const data = await response.json();
        const assistantReply = data.choices?.[0]?.message?.content || "No response";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantReply }
        ]);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return { messages, input, setInput, sendMessage, isLoading };
}

export default function Chat() {
  const { messages, input, setInput, sendMessage, isLoading } = useSimpleChat();
  return (
    <div className="flex flex-col h-[80vh] max-w-lg mx-auto border rounded-lg p-4 bg-white shadow">
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded-lg max-w-xs ${m.role === "user" ? "bg-blue-100 self-end ml-auto" : "bg-gray-100 self-start mr-auto"}`}
          >
            {m.content}
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
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