"use client";

import React, { useState, useRef } from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";

type ChatMessage = { from: string; text: string; time: string; read: boolean };

export const ChatPage = ({ role, selectedYear }: { role: string; selectedYear: string }) => {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const senderLabel = role === "admin" ? "Admin" : role === "principal" ? "Principal" : role === "deputy" ? "Deputy Principal" : "Dean";

  const send = () => {
    if (!msg.trim()) return;
    setMessages(prev => [
      ...prev,
      {
        from: senderLabel,
        text: msg,
        time: new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
        read: true,
      },
    ]);
    setMsg("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", minHeight: 400 }}>
      {/* Header */}
      <div style={{ background: COLORS.forest, borderRadius: "16px 16px 0 0", padding: "12px 20px", color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
        <Icon name="chat" size={18} color="#fff" />
        <span style={{ fontWeight: 700, fontSize: 15 }}>Leadership Office Chat</span>
        <Badge type="gold">Admin · Principal · Deputy · Dean</Badge>
      </div>

      {/* Messages Window */}
      <div style={{ flex: 1, background: "#fff", padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: COLORS.muted, fontSize: 13, marginTop: 40 }}>
            No messages yet. Start the conversation below.
          </div>
        )}
        {messages.map((m: ChatMessage, i: number) => {
          const isMe = m.from === senderLabel;
          return (
            <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "70%" }}>
                {!isMe && <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.forest, marginBottom: 2, marginLeft: 2 }}>{m.from}</div>}
                <div style={{
                  background: isMe ? COLORS.forest : COLORS.cream,
                  color: isMe ? "#fff" : COLORS.charcoal,
                  borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: "10px 14px", fontSize: 14
                }}>
                  {m.text}
                </div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2, textAlign: isMe ? "right" : "left" }}>{m.time}</div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input row */}
      <div style={{ background: "#fff", borderRadius: "0 0 16px 16px", padding: "12px 16px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 8 }}>
        <input
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Type a message..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: 24, border: "1px solid #E5E7EB", fontSize: 14, outline: "none" }}
        />
        <button onClick={send} style={{ background: COLORS.forest, border: "none", borderRadius: 24, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Icon name="send" size={18} color="#fff" />
        </button>
      </div>
    </div>
  );
};
