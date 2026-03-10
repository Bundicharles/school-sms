"use client";

import React from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";

type NavItem = {
  id: string;
  label: string;
  icon: string;
};

interface SidebarProps {
  navItems: NavItem[];
  activePage: string;
  setActivePage: (id: string) => void;
  user: { name: string; role: string; code: string };
  roleColor: string;
  setUser: (user: null) => void;
  schoolLogo?: string;
  schoolName?: string;
  isCollapsed: boolean;
}

export const Sidebar = ({ 
  navItems, activePage, setActivePage, user, roleColor, setUser, schoolLogo, schoolName, isCollapsed 
}: SidebarProps) => {
  return (
    <div style={{
      width: isCollapsed ? 70 : 240, background: COLORS.charcoal, display: "flex", flexDirection: "column",
      position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100,
      transition: "width 0.3s ease", overflow: "hidden"
    }}>
      {/* School header */}
      <div style={{ padding: isCollapsed ? "24px 10px 16px" : "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,.1)", display: "flex", flexDirection: "column", alignItems: isCollapsed ? "center" : "flex-start" }}>
        {schoolLogo ? (
          <img src={schoolLogo} alt="Logo" style={{ width: isCollapsed ? 32 : 44, height: isCollapsed ? 32 : 44, objectFit: "contain", marginBottom: isCollapsed ? 0 : 8 }} />
        ) : (
          <div style={{ fontSize: isCollapsed ? 24 : 22, marginBottom: isCollapsed ? 0 : 4 }}>🏫</div>
        )}
        {!isCollapsed && (
          <>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{schoolName || "Kenya High School"}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>SMS v2.1 · CBE Ready</div>
          </>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 0", overflowY: "auto", overflowX: "hidden" }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setActivePage(n.id)} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "flex-start", gap: isCollapsed ? 0 : 12,
            padding: isCollapsed ? "12px 0" : "10px 20px", background: activePage === n.id ? roleColor : "none",
            border: "none", color: activePage === n.id ? "#fff" : "rgba(255,255,255,.65)",
            cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: activePage === n.id ? 700 : 500,
            transition: "all 0.15s", borderRadius: 0,
            borderLeft: activePage === n.id ? `3px solid ${COLORS.gold}` : "3px solid transparent",
            position: "relative"
          }}
          title={isCollapsed ? n.label : ""}
          >
            <Icon name={n.icon} size={isCollapsed ? 20 : 17} color={activePage === n.id ? "#fff" : "rgba(255,255,255,.65)"} />
            {!isCollapsed && n.label}
          </button>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: isCollapsed ? "16px 10px" : "16px 20px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "flex-start", gap: isCollapsed ? 0 : 10, marginBottom: 10 }}>
          <div style={{ width: isCollapsed ? 32 : 36, height: isCollapsed ? 32 : 36, borderRadius: "50%", background: roleColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: isCollapsed ? 12 : 14 }}>
            {user.name && user.name.length > 0 ? user.name[0] : "👤"}
          </div>
          {!isCollapsed && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{user.name}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", textTransform: "capitalize", fontFamily: "'IBM Plex Mono', monospace" }}>{user.role}</div>
            </div>
          )}
        </div>
        <button onClick={() => setUser(null)} style={{
          width: "100%", background: "rgba(255,255,255,.08)", border: "none", borderRadius: 8,
          padding: isCollapsed ? "8px 0" : "8px", color: "rgba(255,255,255,.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12
        }}
        title={isCollapsed ? "Sign Out" : ""}
        >
          <Icon name="logout" size={isCollapsed ? 18 : 14} color="rgba(255,255,255,.6)" /> {!isCollapsed && "Sign Out"}
        </button>
      </div>
    </div>
  );
};
