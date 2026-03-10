"use client";

import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/utils/supabase/client";
import { UserButton } from "@clerk/nextjs";

interface TopbarProps {
  activeLabel: string;
  offline: boolean;
  user: { name: string; role: string; code: string };
  roleColor: string;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
}

export const Topbar = ({ activeLabel, offline, user, roleColor, isSidebarCollapsed, onToggleSidebar, selectedYear, onYearChange }: TopbarProps) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ title: string; body: string }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const fetchNotifs = async () => {
      const { data } = await supabase
        .from("announcements")
        .select("title, body")
        .order("date", { ascending: false })
        .limit(5);
      if (data) setNotifications(data);
    };
    fetchNotifs();
  }, []);

  return (
    <div style={{
      background: "#fff", padding: "14px 28px", display: "flex", alignItems: "center",
      justifyContent: "space-between", boxShadow: "0 1px 0 rgba(0,0,0,.08)", position: "sticky", top: 0, zIndex: 50
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button 
          onClick={onToggleSidebar}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 8, borderRadius: 8, transition: "background 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        >
          <Icon name="menu" size={20} color={COLORS.charcoal} />
        </button>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: COLORS.charcoal }}>
            {activeLabel}
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>
            Term 2, 2025 · {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {offline && (
          <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "#92400E" }}>
            📶 Offline Mode
          </div>
        )}
        <div style={{ position: "relative" }}>
          <button onClick={() => setNotifOpen(!notifOpen)} style={{ background: COLORS.cream, border: "none", borderRadius: 10, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
            <Icon name="bell" size={18} color={COLORS.charcoal} />
            {notifications.length > 0 && (
              <div style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: "50%", background: COLORS.red, border: "2px solid #fff" }} />
            )}
          </button>
          {notifOpen && (
            <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 8, background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,.16)", width: 320, zIndex: 200, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", fontWeight: 700, fontSize: 13, color: COLORS.forest }}>Notifications</div>
              {notifications.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", fontSize: 13, color: COLORS.muted }}>No announcements yet.</div>
              ) : notifications.map((a, i) => (
                <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = COLORS.cream}
                  onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{a.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.paper, padding: "4px 10px", borderRadius: 10, border: `1px solid ${COLORS.forest}20` }}>
          <Icon name="history" size={16} color={COLORS.forest} />
          <select 
            value={selectedYear} 
            onChange={e => onYearChange(e.target.value)}
            style={{ background: "none", border: "none", outline: "none", fontSize: 13, fontWeight: 700, color: COLORS.charcoal, cursor: "pointer" }}
          >
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y.toString()}>{y} Academic Year</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <UserButton />
          <div style={{
            background: roleColor, color: "#fff", borderRadius: 10, padding: "6px 12px",
            fontSize: 12, fontWeight: 700, textTransform: "capitalize", fontFamily: "'IBM Plex Mono', monospace"
          }}>
            {user.role}
          </div>
        </div>
      </div>
    </div>
  );
};
