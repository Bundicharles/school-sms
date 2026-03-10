import React from "react";

export const Badge = ({ children, type = "default" }: { children: React.ReactNode; type?: string }) => {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: "#E5E7EB", color: "#374151" },
    success: { background: "#D1FAE5", color: "#065F46" },
    warning: { background: "#FEF3C7", color: "#92400E" },
    danger: { background: "#FEE2E2", color: "#991B1B" },
    info: { background: "#DBEAFE", color: "#1E40AF" },
    gold: { background: "#FEF9C3", color: "#713F12" },
  };
  
  const s = styles[type] || styles.default;
  
  return (
    <span style={{
      ...s, padding: "2px 8px", borderRadius: 9999,
      fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
      letterSpacing: "0.04em", whiteSpace: "nowrap"
    }}>
      {children}
    </span>
  );
};
