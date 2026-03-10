"use client";

import React, { useState } from "react";
import { COLORS } from "@/lib/constants";

export const LoginPage = ({ onLogin }: { 
  onLogin: (role: string, code: string) => Promise<string | null>
}) => {
  const [code, setCode] = useState("");
  const [role, setRole] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const roles = [
    { value: "admin", label: "Admin / Secretary", icon: "🏢" },
    { value: "principal", label: "Principal", icon: "👑" },
    { value: "deputy", label: "Deputy Principal", icon: "🎓" },
    { value: "dean", label: "Dean", icon: "📜" },
    { value: "teacher", label: "Teacher", icon: "👨‍🏫" },
    { value: "accounts", label: "Accounts", icon: "💳" },
    { value: "staff", label: "General Staff", icon: "👔" },
    { value: "student", label: "Student", icon: "📚" },
  ];

  const handle = async () => {
    if (!code) { 
      setError("Please enter your login code."); 
      return; 
    }
    setError("");
    setLoading(true);
    
    const err = await onLogin(role, code);

    if (err) {
      setError(err);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: `linear-gradient(135deg, ${COLORS.forest} 0%, ${COLORS.forestMid} 60%, ${COLORS.gold} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif"
    }}>
      <div style={{
        background: "#fff", borderRadius: 24, padding: 40, width: "100%", maxWidth: 420,
        boxShadow: "0 32px 80px rgba(0,0,0,.3)", margin: 20
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏫</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, color: COLORS.forest }}>Kenya School SMS</div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>CBE-Ready Management System </div>
        </div>

        {/* Role selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Select Your Role</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {roles.map(r => (
              <button key={r.value} onClick={() => setRole(r.value)} style={{
                background: role === r.value ? COLORS.forest : COLORS.cream,
                color: role === r.value ? "#fff" : COLORS.charcoal,
                border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer",
                fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.15s"
              }}>
                <span>{r.icon}</span> {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fields */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Login Code</label>
          <input
            type="text"
            placeholder={role === "student" ? "e.g. ADM2024001" : "e.g. ADM001"}
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handle()}
            style={{
              width: "100%", padding: "14px", borderRadius: 12, border: `1px solid #E5E7EB`,
              fontSize: 16, boxSizing: "border-box", outline: "none", fontFamily: "'IBM Plex Mono', monospace",
              transition: "border 0.2s"
            }}
            onFocus={e => e.target.style.border = `1px solid ${COLORS.forest}`}
            onBlur={e => e.target.style.border = "1px solid #E5E7EB"}
          />
        </div>

        {error && <div style={{ color: COLORS.red, fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8 }}>{error}</div>}

        <button onClick={handle} disabled={loading} style={{
          width: "100%", background: loading ? COLORS.muted : `linear-gradient(135deg, ${COLORS.forest}, ${COLORS.forestMid})`,
          color: "#fff", border: "none", borderRadius: 12, padding: "16px", fontSize: 16, fontWeight: 700, cursor: "pointer",
          boxShadow: loading ? "none" : `0 4px 16px ${COLORS.forest}40`,
          opacity: loading ? 0.7 : 1, transition: "transform 0.1s"
        }}
        onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
        onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
        >
          {loading ? "Identifying..." : "Enter School Dashboard →"}
        </button>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: COLORS.muted }}>
          Contact the school ICT office if you forgot your code.
        </div>
      </div>
    </div>
  );
};
