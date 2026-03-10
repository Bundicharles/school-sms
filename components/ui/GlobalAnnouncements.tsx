"use client";

import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/utils/supabase/client";

export const GlobalAnnouncements = ({ role }: { role?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();
  const isOpenRef = React.useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const fetchAnnouncements = React.useCallback(async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, date, priority')
      .order('date', { ascending: false })
      .limit(10);
    
    if (data) {
      setAnnouncements(data);
    }
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      await fetchAnnouncements();
    };
    init();
    
    // Subscribe to new announcements
    const channel = supabase
      .channel('public:announcements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, payload => {
        setAnnouncements(prev => [payload.new, ...prev].slice(0, 10)); // keep last 10
        if (!isOpenRef.current) {
          setUnreadCount(prev => prev + 1);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' }, payload => {
        setAnnouncements(prev => prev.filter(a => a.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAnnouncements, supabase]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  const handleClear = async (id: string | undefined) => {
    if (!id || !confirm("Are you sure you want to clear this announcement from the system?")) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) alert(error.message);
    else setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}>
      {/* Popover */}
      {isOpen && (
        <div style={{
          position: "absolute", bottom: 70, right: 0, width: 340, maxHeight: 500,
          background: "#fff", borderRadius: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column", overflow: "hidden", border: `1px solid ${COLORS.forest}20`
        }}>
          <div style={{ padding: "16px 20px", background: COLORS.forest, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>School Announcements</div>
            <button onClick={() => setIsOpen(false)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12, background: COLORS.paper }}>
            {announcements.length === 0 ? (
              <div style={{ textAlign: "center", color: COLORS.muted, fontSize: 13, padding: 20 }}>No announcements yet.</div>
            ) : (
              announcements.map((a, i) => (
                <div key={a.id || i} style={{
                  padding: 12, borderRadius: 10, background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,.05)",
                  borderLeft: `3px solid ${a.priority === "high" ? COLORS.red : a.priority === "medium" ? COLORS.gold : COLORS.forestLight}`
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.charcoal }}>{a.title}</div>
                    {role === 'admin' && (
                      <button 
                        onClick={() => handleClear(a.id)}
                        style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 11, fontWeight: 700, padding: 0 }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{a.body}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6, fontFamily: "'IBM Plex Mono', monospace" }}>{new Date(a.date).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button 
        onClick={handleToggle}
        style={{
          width: 56, height: 56, borderRadius: 28, background: COLORS.forest, color: "#fff",
          border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s, background 0.2s", position: "relative"
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        <Icon name="chat" size={24} color="#fff" />
        {unreadCount > 0 && !isOpen && (
          <span style={{
            position: "absolute", top: -4, right: -4, background: COLORS.red, color: "#fff",
            fontSize: 10, fontWeight: 800, minWidth: 20, height: 20, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff"
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
