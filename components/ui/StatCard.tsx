import React from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "./Icon";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: string;
}

export const StatCard = ({ label, value, sub, color, icon }: StatCardProps) => (
  <div style={{
    background: "#fff", borderRadius: 16, padding: "20px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.04)",
    display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden",
    borderLeft: `4px solid ${color}`
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <div style={{ color, opacity: 0.7 }}><Icon name={icon} size={18} color={color} /></div>
    </div>
    <div style={{ fontSize: 32, fontWeight: 800, color: COLORS.charcoal, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: COLORS.muted }}>{sub}</div>}
  </div>
);
