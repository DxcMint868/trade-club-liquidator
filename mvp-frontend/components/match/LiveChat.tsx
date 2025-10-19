"use client";

import { useState } from "react";

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  role: "MONACHAD" | "SUPPORTER";
}

interface LiveChatProps {
  matchId: string;
  currentUserAddress?: string;
}

export default function LiveChat({ matchId, currentUserAddress }: LiveChatProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "0x1234567890abcdef",
      message: "Let's go! Time to make some gains 🚀",
      timestamp: new Date(Date.now() - 60000),
      role: "MONACHAD",
    },
    {
      id: "2",
      sender: "0xabcdef1234567890",
      message: "Following you! Best trader here 🎯",
      timestamp: new Date(Date.now() - 45000),
      role: "SUPPORTER",
    },
    {
      id: "3",
      sender: "0x9876543210fedcba",
      message: "This is intense! 🔥",
      timestamp: new Date(Date.now() - 30000),
      role: "SUPPORTER",
    },
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: currentUserAddress || "You",
      message: message.trim(),
      timestamp: new Date(),
      role: "SUPPORTER", // TODO: Get from user role
    };

    setMessages([...messages, newMessage]);
    setMessage("");
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-lg border border-purple-500/30 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-purple-500/30 bg-black/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white">Live Chat</h3>
            <span className="px-2 py-1 text-xs font-semibold bg-green-500/20 text-green-400 rounded border border-green-500/30">
              {messages.length} messages
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-slate-400">Live</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-slate-800/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg ${
              msg.role === "MONACHAD"
                ? "bg-purple-500/10 border border-purple-500/30"
                : "bg-slate-800/50 border border-slate-700/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-bold ${
                  msg.role === "MONACHAD" ? "text-purple-400" : "text-blue-400"
                }`}
              >
                {msg.role === "MONACHAD" ? "🎮" : "🎯"}{" "}
                {msg.sender.slice(0, 6)}...{msg.sender.slice(-4)}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-slate-200">{msg.message}</p>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-purple-500/30 bg-black/30">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
