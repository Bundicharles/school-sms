import React from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "./Icon";

interface SectionHeaderProps {
  title: string;
  action?: {
    label: string;
    fn: () => void;
  };
}

export const SectionHeader = ({ title, action }: SectionHeaderProps) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.charcoal, fontFamily: "'Playfair Display', serif" }}>{title}</h3>
    {action && (
      <button onClick={action.fn} style={{
        background: COLORS.forest, color: "#fff", border: "none", borderRadius: 8,
        padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
      }}>
        <Icon name="add" size={14} color="#fff" /> {action.label}
      </button>
    )}
  </div>
);
