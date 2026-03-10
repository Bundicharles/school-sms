"use client";

import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/constants";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";

export const DashboardPage = ({ 
  role, 
  onSelectStudent, 
  onSettingsUpdate,
  selectedYear
}: { 
  role: string; 
  onSelectStudent: (id: string, adm: string) => void; 
  onSettingsUpdate?: () => void;
  selectedYear: string;
}) => {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Real Data State
  const [stats, setStats] = useState({
    students: 0, classes: 0, teachers: 0, defaulters: 0
  });
  const [defaultersList, setDefaultersList] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [teachersOnDuty, setTeachersOnDuty] = useState<any[]>([]);
  const [schoolSettings, setSchoolSettings] = useState({
    school_name: "KENYA HIGH SCHOOL",
    school_address: "P.O. Box 1234 - 00100, Nairobi",
    school_phone: "+254 700 000 000",
    school_motto: "Where Excellence is a Tradition",
    school_logo_url: ""
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';
  
  // Announcement Input State
  const [newAnnTitle, setNewAnnTitle] = useState("");
  const [newAnnBody, setNewAnnBody] = useState("");
  const [newAnnPriority, setNewAnnPriority] = useState("low");
  const [isSubmittingAnn, setIsSubmittingAnn] = useState(false);

  const supabase = createClient();

  // Helper to fetch Announcements
  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, date, priority')
      .order('date', { ascending: false })
      .limit(5);
    if (data) setAnnouncements(data);
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      // Get basic counts
      const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
      const { count: classCount } = await supabase.from('classes').select('*', { count: 'exact', head: true });
      const { count: teacherCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['teacher', 'principal', 'deputy']).eq('status', 'active');

      // Fetch level fees (fallback expected amounts)
      const CURRENT_TERM = `Term 2, ${selectedYear}`;
      const { data: levelFees } = await supabase.from('level_fees').select('level, amount').eq('term', CURRENT_TERM);
      const levelFeeMap: Record<string, number> = {};
      (levelFees || []).forEach((lf: any) => { levelFeeMap[String(lf.level)] = lf.amount; });

      // Fetch all students with their class level (including inactive ones)
      const { data: allStudents } = await supabase
        .from('students')
        .select('id, status, profiles:profile_id(full_name, code), classes:class_id(name, level)');

      // Fetch fees for current term
      const { data: feerows } = await supabase
        .from('fees')
        .select('student_id, paid_amount, expected_amount')
        .eq('term', CURRENT_TERM);

      const feeMap: Record<string, { paid: number; expected: number }> = {};
      (feerows || []).forEach((f: any) => {
        feeMap[f.student_id] = { paid: f.paid_amount ?? 0, expected: f.expected_amount ?? 0 };
      });

      let defs = 0;
      const dList: any[] = [];

      (allStudents || []).forEach((student: any) => {
        const profile = student.profiles;
        const cls = student.classes;
        if (!profile) return;

        const feeRecord = feeMap[student.id];
        const level = String(cls?.level || '1');
        const expected = feeRecord?.expected ?? levelFeeMap[level] ?? 0;
        const paid = feeRecord?.paid ?? 0;
        const balance = expected - paid;

        if (expected > 0 && balance > 0) {
          defs++;
          dList.push({
            adm: profile.code,
            name: profile.full_name,
            class: cls?.name || 'N/A',
            balance,
            expected,
            paid,
          });
        }
      });

      // Sort by highest balance first
      dList.sort((a, b) => b.balance - a.balance);

      setStats({
        students: studentCount || 0,
        classes: classCount || 0,
        teachers: teacherCount || 0,
        defaulters: defs
      });
      setDefaultersList(dList);

      // Fetch Announcements
      await fetchAnnouncements();

      // Fetch Teachers on Duty Today
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: dutyData } = await supabase
        .from('duty_roster')
        .select('shift, profiles(full_name, code)')
        .eq('duty_date', todayStr);
      if (dutyData) setTeachersOnDuty(dutyData);

      // Fetch School Settings
      const { data: settings } = await supabase.from('school_settings')
        .select('*')
        .eq('id', SETTINGS_ID)
        .maybeSingle();
      if (settings) setSchoolSettings(settings);
    };

    fetchDashboard();
  }, [supabase, selectedYear]);

  const handleAddAnnouncement = async () => {
    if (!newAnnTitle.trim() || !newAnnBody.trim()) {
      alert("Please provide both a title and body for the announcement.");
      return;
    }
    setIsSubmittingAnn(true);
    const { error } = await supabase.from('announcements').insert([{
      title: newAnnTitle.trim(),
      body: newAnnBody.trim(),
      priority: newAnnPriority,
      date: new Date().toISOString()
    }]);

    if (error) {
      alert("Error: " + error.message);
    } else {
      setNewAnnTitle("");
      setNewAnnBody("");
      setNewAnnPriority("low");
      await fetchAnnouncements();
    }
    setIsSubmittingAnn(false);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    const { error } = await supabase
      .from('school_settings')
      .upsert({ ...schoolSettings, id: SETTINGS_ID });

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("School settings updated!");
      if (onSettingsUpdate) onSettingsUpdate();
    }
    setSavingSettings(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setSavingSettings(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;
      const filePath = `branding/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Auto-save the URL to DB
      const updatedSettings = { ...schoolSettings, school_logo_url: publicUrl, id: SETTINGS_ID };
      
      const { error: upsertError } = await supabase
        .from('school_settings')
        .upsert(updatedSettings);

      if (upsertError) throw upsertError;

      setSchoolSettings(updatedSettings);
      if (onSettingsUpdate) onSettingsUpdate();

      alert("Logo uploaded and updated!");
    } catch (error: any) {
      alert("Logo upload failed: " + error.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleClearAnnouncement = async (id: string | undefined) => {
    if (!id || !confirm("Are you sure you want to clear this announcement from the system?")) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) alert(error.message);
    else await fetchAnnouncements(); // refresh local list
  };

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }

    // Global search across profiles
    const { data } = await supabase
      .from('profiles')
      .select('code, full_name')
      .or(`code.ilike.%${q}%,full_name.ilike.%${q}%`)
      .limit(5);

    if (data) {
      // Join with students table to get student id
      const codes = data.map(d => d.code);
      const { data: stData } = await supabase.from('students').select('id, status, profiles(code)').in('profiles.code', codes);

      setSearchResults(data.map(d => {
        // Find matching student
        const studentMatch = stData?.find(s => {
          // Type guard for the joined profile object structure
          const profile = s.profiles as any;
          return profile && profile.code === d.code;
        });

        return {
          id: studentMatch?.id, // This is the UUID from students table
          adm: d.code,
          name: d.full_name,
          class: studentMatch?.id ? (studentMatch.status === 'active' ? "Click to view full profile" : `Status: ${studentMatch.status.toUpperCase()}`) : "Staff Profile",
          status: studentMatch?.status || 'active',
          balance: 0
        };
      }));
    }
  };

  const [showAllDefaulters, setShowAllDefaulters] = useState(false);

  // Print/Export Helpers
  const buildTableHTML = (title: string, rows: string[][], headers: string[]) => `
    <div style="margin-bottom:32px">
      <h2 style="font-family:sans-serif;font-size:16px;margin-bottom:8px;border-bottom:2px solid #b91c1c;padding-bottom:4px;color:#b91c1c">${title}</h2>
      <table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:12px">
        <thead><tr>${headers.map(h => `<th style="background:#b91c1c;color:#fff;padding:8px;text-align:left">${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr style="background:${i % 2 === 0 ? "#f9f9f9" : "#fff"}">${r.map((c, ci) => `<td style="padding:7px 8px;border-bottom:1px solid #eee;${ci === rows[0].length - 1 ? "font-weight:700;color:#b91c1c" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>`;


  const handleExportDefaulters = () => {
    if (defaultersList.length === 0) return alert("No defaulters to export.");

    // Group by class
    const grouped: Record<string, any[]> = {};
    defaultersList.forEach(d => {
      if (!grouped[d.class]) grouped[d.class] = [];
      grouped[d.class].push(d);
    });

    let body = `<h1 style="font-family:sans-serif;font-size:20px;color:#b91c1c">FEE DEFAULTERS LIST (Grouped by Class)</h1>`;

    Object.keys(grouped).sort().forEach(className => {
      const classDefaulters = grouped[className];
      const rows = classDefaulters.map(d => [d.adm, d.name, d.expected.toLocaleString(), d.paid.toLocaleString(), d.balance.toLocaleString()]);
      body += buildTableHTML(`Class: ${className}`, rows, ["ADM", "Name", "Expected", "Paid", "Balance (KSh)"]);
    });

    const w = window.open("", "_blank");
    if (w) { w.document.write(`<html><body>${body}<script>window.onload=()=>window.print();</script></body></html>`); w.document.close(); }
  };

  const displayedDefaulters = showAllDefaulters ? defaultersList : defaultersList.slice(0, 4);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
        <StatCard label="Total Students" value={stats.students} sub="Active enrolment" color={COLORS.forest} icon="users" />
        <StatCard label="Teachers" value={stats.teachers} color={COLORS.sky} icon="book" />
        <StatCard label="Classes" value={stats.classes} sub="Form 1–4" color={COLORS.gold} icon="office" />
        <StatCard label="Defaulters" value={stats.defaulters} sub="Outstanding balances" color={COLORS.red} icon="warn" />
      </div>

      {/* Global Search */}
      <div style={{ position: "relative" }}>
        <div style={{
          background: "#fff", borderRadius: 12, padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 1px 3px rgba(0,0,0,.1), 0 0 0 2px " + (search ? COLORS.forest : "transparent"),
          transition: "box-shadow 0.2s"
        }}>
          <Icon name="search" size={18} color={COLORS.muted} />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search Database by ADM number or Profile name..."
            style={{ border: "none", outline: "none", flex: 1, fontSize: 14, background: "transparent", color: COLORS.charcoal }}
          />
          {search && <button onClick={() => handleSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>✕</button>}
        </div>

        {searchResults.length > 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, background: "#fff",
            borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,.16)", zIndex: 100,
            marginTop: 4, overflow: "hidden"
          }}>
            <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: COLORS.forestLight, background: COLORS.cream }}>DATABASE RESULTS</div>
            {searchResults.map(s => (
              <div key={s.adm} style={{
                padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                borderBottom: "1px solid #F3F4F6", cursor: "pointer",
                transition: "background 0.15s"
              }}
                onMouseEnter={e => e.currentTarget.style.background = COLORS.cream}
                onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                onClick={() => s.id && onSelectStudent(s.id, s.adm)}
              >
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.forest, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>
                  {s.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    {s.name}
                    {s.status !== 'active' && <Badge type="danger">{s.status.toUpperCase()}</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{s.adm}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
        {/* Announcements */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <SectionHeader title="📢 Announcements" />
          
          {role === 'admin' && (
            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #F3F4F6", display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                value={newAnnTitle}
                onChange={e => setNewAnnTitle(e.target.value)}
                placeholder="Announcement Title"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }}
              />
              <textarea
                value={newAnnBody}
                onChange={e => setNewAnnBody(e.target.value)}
                placeholder="Announcement details..."
                rows={2}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select 
                  value={newAnnPriority} 
                  onChange={e => setNewAnnPriority(e.target.value)}
                  style={{ padding: "8px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, outline: "none" }}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <button 
                  onClick={handleAddAnnouncement}
                  disabled={isSubmittingAnn}
                  style={{ 
                    flex: 1, padding: "8px", background: COLORS.forest, color: "#fff", border: "none", 
                    borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: isSubmittingAnn ? 0.7 : 1 
                  }}
                >
                  {isSubmittingAnn ? "Posting..." : "Post Announcement"}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {announcements.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>No announcements yet.</div>
            ) : announcements.map((a: any, i: number) => (
              <div key={a.id || i} style={{
                padding: 12, borderRadius: 10, background: a.priority === "high" ? "#FEF2F2" : a.priority === "medium" ? "#FFFBEB" : COLORS.cream,
                borderLeft: `3px solid ${a.priority === "high" ? COLORS.red : a.priority === "medium" ? COLORS.gold : COLORS.forestLight}`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.charcoal }}>{a.title}</div>
                  {role === 'admin' && (
                    <button 
                      onClick={() => handleClearAnnouncement(a.id)}
                      style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 11, fontWeight: 700, padding: 0 }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{a.body}</div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>{new Date(a.date).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Database Fee Defaulters */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <SectionHeader
            title={`⚠️ Fee Defaulters (${defaultersList.length})`}
            action={{ label: "Export PDF", fn: handleExportDefaulters }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {displayedDefaulters.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>No defaulters found in database or no fees have been recorded yet.</div>
            ) : displayedDefaulters.map(s => (
              <div key={s.adm} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.red, fontWeight: 700, fontSize: 13 }}>
                  {s.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{s.class}</div>
                </div>
                <Badge type={s.balance > 20000 ? "danger" : s.balance > 5000 ? "warning" : "default"}>
                  KSh {s.balance.toLocaleString()}
                </Badge>
              </div>
            ))}

            {defaultersList.length > 4 && (
              <button
                onClick={() => setShowAllDefaulters(!showAllDefaulters)}
                style={{
                  marginTop: 8, padding: "10px", background: "#F9FAFB", border: "1px solid #E5E7EB",
                  borderRadius: 8, color: COLORS.charcoal, fontWeight: 600, fontSize: 12, cursor: "pointer",
                  transition: "background 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
                onMouseLeave={e => e.currentTarget.style.background = "#F9FAFB"}
              >
                {showAllDefaulters ? "Show Less" : `View All ${defaultersList.length} Defaulters`}
              </button>
            )}
          </div>
        </div>

        {/* Teacher on Duty Pad */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <SectionHeader title="👮 Teacher on Duty" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {teachersOnDuty.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>No teachers on duty scheduled for today.</div>
            ) : teachersOnDuty.map((duty: any, i: number) => (
              <div key={i} style={{
                padding: 12, borderRadius: 10, background: duty.shift === 'Day' ? '#F0F9FF' : '#FFFBEB',
                borderLeft: `3px solid ${duty.shift === 'Day' ? COLORS.sky : COLORS.gold}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: duty.shift === 'Day' ? COLORS.sky : COLORS.gold, textTransform: "uppercase", marginBottom: 4 }}>{duty.shift} SHIFT</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.charcoal }}>{duty.profiles?.full_name || 'Unknown'}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>Code: {duty.profiles?.code || 'N/A'}</div>
                </div>
                <div style={{ fontSize: 20 }}>{duty.shift === 'Day' ? '☀️' : '🌙'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {role === 'admin' && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <SectionHeader title="⚙️ School Global Settings" action={{ label: savingSettings ? "Saving..." : "Save Branding", fn: saveSettings }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>School Name</label>
              <input
                value={schoolSettings.school_name}
                onChange={e => setSchoolSettings({ ...schoolSettings, school_name: e.target.value })}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>School Motto</label>
              <input
                value={schoolSettings.school_motto || ""}
                onChange={e => setSchoolSettings({ ...schoolSettings, school_motto: e.target.value })}
                placeholder="Where Excellence is a Tradition"
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Address</label>
              <input
                value={schoolSettings.school_address}
                onChange={e => setSchoolSettings({ ...schoolSettings, school_address: e.target.value })}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Phone / Contact</label>
              <input
                value={schoolSettings.school_phone}
                onChange={e => setSchoolSettings({ ...schoolSettings, school_phone: e.target.value })}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>School Email</label>
              <input
                value={schoolSettings.school_email || ""}
                onChange={e => setSchoolSettings({ ...schoolSettings, school_email: e.target.value })}
                placeholder="info@school.ac.ke"
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 14 }}
              />
            </div>
          </div>
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 80, height: 80, borderRadius: 12, border: `2px dashed ${COLORS.forest}40`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: COLORS.paper }}>
              {schoolSettings.school_logo_url ? (
                <img src={schoolSettings.school_logo_url} alt="School Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <Icon name="image" size={24} color={COLORS.muted} />
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>School Logo</label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ fontSize: 12 }} />
              <p style={{ fontSize: 10, color: COLORS.muted, marginTop: 4 }}>Recommended: Square PNG/JPG with transparent background.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

