"use client";

import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { createClient } from "@/utils/supabase/client";

export const StaffPage = ({ role, selectedYear }: { role: string, selectedYear: string }) => {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [viewFilter, setViewFilter] = useState("active");

  const canManage = ["admin", "principal", "deputy"].includes(role);

  // New Staff Form
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newRole, setNewRole] = useState("teacher");
  
  // Tag Assignment Form
  const [tagStaffCode, setTagStaffCode] = useState("");
  const [tagType, setTagType] = useState("HOD");
  const [tagAssignment, setTagAssignment] = useState("");

  const supabase = createClient();

  const fetchStaff = async () => {
    setLoading(true);
    // Fetch profiles and join departments where they are HOD and classes where they are Class Teacher
    const { data, error } = await supabase
      .from('profiles')
      .select('*, departments!hod_id(name), classes!class_teacher_id(name)')
      .in('role', ['admin', 'principal', 'deputy', 'dean', 'teacher', 'accounts', 'staff'])
      .order('full_name');

    if (error) {
       console.error(error);
    }
    if (data) {
      // If status column doesn't exist yet, default it to active
      setStaff(data.map(d => ({ ...d, status: d.status || 'active' })));
    }
    setLoading(false);
  };
  
  const fetchAuxData = async () => {
    const { data: cData } = await supabase.from('classes').select('id, name').order('name');
    if (cData) setAllClasses(cData);
    
    const { data: dData } = await supabase.from('departments').select('id, name').order('name');
    if (dData) setAllDepartments(dData);
  };

  useEffect(() => {
    fetchStaff();
    fetchAuxData();
  }, []);

  const handleAddStaff = async () => {
    if (!newName || !newCode) {
      alert("Please enter Name and Staff Code.");
      return;
    }

    setLoading(true);
    // 1. Check if code exists
    const { data: existing } = await supabase.from('profiles').select('id').eq('code', newCode).maybeSingle();
    if (existing) {
      alert("Staff Code " + newCode + " is already in use.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('profiles').insert([
      { 
        full_name: newName, 
        code: newCode, 
        role: newRole 
      }
    ]);

    if (error) {
      alert("Error adding staff: " + error.message);
    } else {
      alert("Staff Member " + newName + " added successfully to Database!");
      setNewName("");
      setNewCode("");
      setShowAdd(false);
      fetchStaff();
    }
    setLoading(false);
  };

  const handleApplyTag = async () => {
    if (!tagStaffCode || !tagAssignment) {
      alert("Please enter Staff Code and Assignment (Dept/Class).");
      return;
    }

    setLoading(true);
    // 1. Find profile
    const { data: profile } = await supabase.from('profiles').select('id').eq('code', tagStaffCode).maybeSingle();
    if (!profile) {
      alert("Staff Code not found.");
      setLoading(false);
      return;
    }

    if (tagType === "HOD") {
      // 2. Update Department
      const { error } = await supabase
        .from('departments')
        .update({ hod_id: profile.id })
        .or(`name.eq."${tagAssignment}",code.eq."${tagAssignment}"`);
      
      if (error) alert("Error assigning HOD: " + error.message);
      else alert("HOD assigned successfully!");
    } else {
      // 3. Update Class
      const { error } = await supabase
        .from('classes')
        .update({ class_teacher_id: profile.id })
        .eq('name', tagAssignment);
      
      if (error) alert("Error assigning Class Teacher: " + error.message);
      else alert("Class Teacher assigned successfully!");
    }

    setTagStaffCode("");
    setTagAssignment("");
    fetchStaff();
    setLoading(false);
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    let reason = "";
    if (newStatus !== 'active') {
      reason = prompt(`Please enter a reason for marking this staff as ${newStatus}:`) || "No reason provided";
    }

    if (!confirm(`Are you sure you want to mark this staff member as ${newStatus}?`)) return;
    setLoading(true);
    
    // Clear assignments if archiving or suspending
    if (newStatus === 'archived' || newStatus === 'suspended') {
      const { data: profile } = await supabase.from('profiles').select('id, full_name').eq('id', id).single();
      if (profile) {
        await supabase.from('departments').update({ hod_id: null }).eq('hod_id', id);
        await supabase.from('classes').update({ class_teacher_id: null }).eq('class_teacher_id', id);
      }
    }

    const { error } = await supabase.from('profiles').update({ 
      status: newStatus,
      status_reason: reason,
      status_changed_at: new Date().toISOString()
    }).eq('id', id);
    if (error) {
      alert("Error updating status. Please ensure you have run the schema migration to add 'status' to profiles.\n\nMigration: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';\n\nOriginal Error: " + error.message);
    } else {
      alert(`Staff marked as ${newStatus}`);
      fetchStaff();
    }
    setLoading(false);
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`DANGER: Are you sure you want to permanently DELETE ${name}? \n\nIf they have records (exams, duty, etc), this might fail. We recommend 'Archiving' them instead.`)) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      alert(`Failed to delete. They likely have database records attached (results, duties, etc).\n\nPlease 'Archive' them instead to retain the history.\n\nError: ` + error.message);
    } else {
      alert(`Staff deleted permanently.`);
      fetchStaff();
    }
    setLoading(false);
  };

  const filteredStaff = staff.filter(s => s.status === viewFilter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionHeader title="👥 Staff Management" />
        {canManage && (
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ background: COLORS.paper, padding: 4, borderRadius: 10, display: "flex" }}>
              {(["active", "suspended", "archived"]).map(st => (
                <button 
                  key={st}
                  onClick={() => setViewFilter(st)}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    textTransform: "capitalize", border: "none", cursor: "pointer",
                    background: viewFilter === st ? "#fff" : "transparent",
                    color: viewFilter === st ? COLORS.forest : COLORS.muted,
                    boxShadow: viewFilter === st ? "0 1px 3px rgba(0,0,0,.1)" : "none",
                    transition: "all 0.2s"
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAdd(!showAdd)} style={{
              background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10,
              padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}>
              <Icon name="add" size={14} color="#fff" /> Add Staff Member
            </button>
          </div>
        )}
      </div>

      {showAdd && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,.12)", border: `2px solid ${COLORS.forest}`, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.forest }}>➕ Register New Staff Account</div>
            <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
              <Icon name="close" size={20} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Full Name</label>
              <input value={newName || ""} onChange={e=>setNewName(e.target.value)} placeholder="e.g. John Doe" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Staff Code (Unique)</label>
              <input value={newCode || ""} onChange={e=>setNewCode(e.target.value)} placeholder="e.g. STF005" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box", fontFamily: "'IBM Plex Mono', monospace" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Role</label>
              <select value={newRole || "teacher"} onChange={e=>setNewRole(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box" }}>
                <option value="teacher">Teacher</option>
                <option value="dean">Dean</option>
                <option value="staff">General Staff</option>
                <option value="principal">Principal</option>
                <option value="deputy">Deputy Principal</option>
                <option value="accounts">Accounts</option>
                <option value="admin">Admin / Secretary</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={handleAddStaff} style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, cursor: "pointer" }}>Create Staff Account</button>
            <button onClick={() => setShowAdd(false)} style={{ background: COLORS.cream, border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: COLORS.cream }}>
              {["Staff Code", "Name", "Role", "Status", "Special Tags", "Actions"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: COLORS.muted }}>Loading staff records...</td></tr>
            ) : filteredStaff.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: COLORS.muted }}>No {viewFilter} staff members found.</td></tr>
            ) : filteredStaff.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #F3F4F6", opacity: s.status !== 'active' ? 0.6 : 1 }}>
                <td style={{ padding: "12px 16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.forest, fontWeight: 600 }}>{s.code}</td>
                <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14 }}>
                  {s.full_name}
                  {s.status === 'suspended' && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.red, background: "#FEE2E2", padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>SUSPENDED</span>}
                  {s.status === 'archived' && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.muted, background: COLORS.paper, padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>ARCHIVED</span>}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <Badge type={
                    s.role === 'admin' ? 'danger' : 
                    s.role === 'principal' ? 'warning' : 
                    s.role === 'deputy' ? 'info' : 
                    s.role === 'dean' ? 'gold' : 
                    s.role === 'staff' ? 'paper' : 'info'
                  }>
                    {s.role.toUpperCase()}
                  </Badge>
                </td>
                <td style={{ padding: "12px 16px" }}>
                   <div style={{ display: "flex", flexDirection: "column" }}>
                     <span style={{ 
                       fontSize: 12, fontWeight: 700, 
                       color: s.status === 'active' ? COLORS.forest : (s.status === 'suspended' ? COLORS.red : COLORS.muted) 
                     }}>
                       {String(s.status).charAt(0).toUpperCase() + String(s.status).slice(1)}
                     </span>
                     {s.status_reason && (
                       <span style={{ fontSize: 10, color: COLORS.muted, fontStyle: "italic", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.status_reason}>
                         {s.status_reason}
                       </span>
                     )}
                   </div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {s.departments?.map((d: any) => <Badge key={d.name} type="warning">HOD: {d.name}</Badge>)}
                    {s.classes?.map((c: any) => <Badge key={c.name} type="info">CT: {c.name}</Badge>)}
                    {(!s.departments?.length && !s.classes?.length) && <span style={{ fontSize: 11, color: COLORS.muted }}>-</span>}
                  </div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {canManage && s.id !== "00000000-0000-0000-0000-000000000000" && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {s.status === 'active' ? (
                        <>
                          <button onClick={() => handleUpdateStatus(s.id, 'suspended')} style={{ background: "#FEF2F2", color: COLORS.red, border: `1px solid ${COLORS.red}30`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Suspend</button>
                          <button onClick={() => handleUpdateStatus(s.id, 'archived')} style={{ background: COLORS.paper, color: COLORS.charcoal, border: `1px solid ${COLORS.muted}50`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Archive</button>
                          <button onClick={() => handleDeleteStaff(s.id, s.full_name)} style={{ background: COLORS.red, color: "#fff", border: `1px solid ${COLORS.red}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Remove</button>
                        </>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => handleUpdateStatus(s.id, 'active')} style={{ background: "#F0FDF4", color: COLORS.forest, border: `1px solid ${COLORS.forest}30`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Re-activate</button>
                          <button onClick={() => handleDeleteStaff(s.id, s.full_name)} style={{ background: COLORS.red, color: "#fff", border: `1px solid ${COLORS.red}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Delete Permanently</button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Assignment Tags (HOD / Class Teacher) */}
      {canManage && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)", border: `2px solid ${COLORS.goldLight}` }}>
          <SectionHeader title="🏷️ Assign Authority Tags (HOD / Class Teacher)" />
          <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 16 }}>
            Assign teachers as <strong>Head of Department (HOD)</strong> or <strong>Class Teachers</strong> to grant them authority over specific students and subjects.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Staff Member</label>
              <select 
                value={tagStaffCode || ""} 
                onChange={e => setTagStaffCode(e.target.value)} 
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box", background: "#fff" }}
              >
                <option value="">-- Select Staff --</option>
                {staff.map(s => <option key={s.id} value={s.code}>{s.full_name} ({s.code})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Tag Type</label>
              <select value={tagType || "HOD"} onChange={e=>setTagType(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box", background: "#fff" }}>
                <option value="HOD">Head of Department (HOD)</option>
                <option value="Class Teacher">Class Teacher</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Assignment (Dept / Class Name)</label>
              {tagType === "HOD" ? (
                <select 
                  value={tagAssignment || ""} 
                  onChange={e => setTagAssignment(e.target.value)} 
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box", background: "#fff" }}
                >
                  <option value="">-- Select Department --</option>
                  {allDepartments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              ) : (
                <select 
                  value={tagAssignment || ""} 
                  onChange={e => setTagAssignment(e.target.value)} 
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box", background: "#fff" }}
                >
                  <option value="">-- Select Class --</option>
                  {allClasses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              )}
            </div>
          </div>
          <button onClick={handleApplyTag} disabled={loading} style={{ 
            marginTop: 16, background: COLORS.gold, color: COLORS.charcoal, border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, cursor: "pointer",
            opacity: loading ? 0.7 : 1
          }}>
            {loading ? "Applying..." : "Apply Authority Tag"}
          </button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <SectionHeader title="🛡️ Secure Office Access" />
        <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
          All department and office data is protected by Row Level Security (RLS). 
          Only members assigned as <strong>HODs</strong> or <strong>Administrators</strong> can access 
          sensitive financial and departmental records. 
          Staff codes are unique and encrypted to prevent data leaks.
        </p>
      </div>
    </div>
  );
};
