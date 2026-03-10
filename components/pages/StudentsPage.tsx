"use client";

import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";

export const StudentsPage = ({ role, code, selectedYear, onSelectStudent }: { role: string; code: string; selectedYear: string; onSelectStudent?: (id: string, adm: string) => void }) => {
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("All");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [viewFilter, setViewFilter] = useState("active");

  // New Student Form
  const [newAdm, setNewAdm] = useState("");
  const [newName, setNewName] = useState("");
  const [newClassId, setNewClassId] = useState("");

  const [dbClasses, setDbClasses] = useState<any[]>([]); // {id, name}
  const supabase = createClient();

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name');
    if (data) {
      setDbClasses(data);
      if (data.length > 0 && !newClassId) {
        setNewClassId(data[0].id);
      }
    }
  };

  // Fetch students on mount
  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select(`
        id,
        status,
        status_reason,
        classes (name),
        profiles (id, full_name, code)
      `);
      
    if (data) {
      const mapped = data.map((d: any) => ({
        id: d.id,
        profile_id: d.profiles?.id,
        adm: d.profiles?.code || "N/A",
        name: d.profiles?.full_name || "Unknown",
        class: d.classes?.name || "Unassigned",
        balance: 0,
        status: (d.status || 'active').toLowerCase(),
        status_reason: d.status_reason
      }));
      setStudents(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, [selectedYear]);

  const handleAddStudent = async () => {
    if (!newAdm || !newName || !newClassId) {
      alert("Please enter Admission Number, Name and select a Class.");
      return;
    }
    
    setLoading(true);
    // 1. Check if ADM exists
    const { data: existing } = await supabase.from('profiles').select('id').eq('code', newAdm).maybeSingle();
    if (existing) {
      alert("Admission Number " + newAdm + " is already in use.");
      setLoading(false);
      return;
    }

    // 2. Create Profile
    const { data: profileData, error: profileErr } = await supabase.from('profiles').insert([
      { full_name: newName, code: newAdm, role: 'student' }
    ]).select().single();

    if (profileErr) {
      alert("Error creating profile: " + profileErr.message);
      setLoading(false);
      return;
    }

    // 3. Create Student
    const { error: studentErr } = await supabase.from('students').insert([
      { profile_id: profileData.id, class_id: newClassId, status: 'active' }
    ]);

    if (studentErr) {
      alert("Error registering student: " + studentErr.message);
    } else {
      alert("Student " + newName + " registered successfully!");
      setNewName("");
      setNewAdm("");
      setShowAdd(false);
      fetchStudents();
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    let reason = "";
    if (newStatus !== 'active') {
       reason = prompt(`Please enter a reason for marking this student as ${newStatus}:`) || "No reason provided";
    }

    if (!confirm(`Are you sure you want to mark this student as ${newStatus}?`)) return;
    setLoading(true);
    const { error } = await supabase.from('students').update({ 
      status: newStatus,
      status_reason: reason,
      status_changed_at: new Date().toISOString()
    }).eq('id', id);
    if (error) {
      alert("Error updating status: " + error.message);
    } else {
      alert(`Student marked as ${newStatus}`);
      fetchStudents();
    }
    setLoading(false);
  };

  const handleDeleteStudent = async (studentId: string, profileId: string, name: string) => {
    if (!confirm(`DANGER: Are you sure you want to permanently DELETE ${name}?\nRecommended to 'Archive' instead.`)) return;
    setLoading(true);
    // Delete profile (student is cascade deleted)
    const { error } = await supabase.from('profiles').delete().eq('id', profileId);
    if (error) {
      alert(`Failed to delete student records. They may have exams or fee records.\nError: ` + error.message);
    } else {
      alert(`Student deleted permanently.`);
      fetchStudents();
    }
    setLoading(false);
  };

  const filtered = students.filter(s => {
    const matchClass = selectedClass === "All" || s.class === selectedClass;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.adm.toLowerCase().includes(search.toLowerCase());
    
    if (viewFilter === "active") {
      return matchClass && matchSearch && s.status === "active";
    } else {
      // Inactive/Other category
      return matchClass && matchSearch && ["suspended", "expelled", "archived"].includes(s.status);
    }
  });

  const handleOpenDetails = async (student: any) => {
    setLoading(true);
    // Fetch detailed info from student_files
    const { data: fileData } = await supabase
      .from('student_files')
      .select('*')
      .eq('student_id', student.id)
      .maybeSingle();
    
    setSelectedStudent({ ...student, details: fileData || {} });
    setLoading(false);
  };

  const handleExportCSV = () => {
    const headers = ["ADM Number", "Name", "Class", "Status", "Reason"];
    const rows = filtered.map(s => [s.adm, s.name, s.class, s.status, s.status_reason || ""]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `students_${viewFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Search & Filter Bar */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ background: COLORS.paper, padding: 4, borderRadius: 10, display: "flex" }}>
          {[
            { id: "active", label: "Active Students" },
            { id: "inactive", label: "Inactive / Other" }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setViewFilter(tab.id)}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                border: "none", cursor: "pointer",
                background: viewFilter === tab.id ? "#fff" : "transparent",
                color: viewFilter === tab.id ? COLORS.forest : COLORS.muted,
                boxShadow: viewFilter === tab.id ? "0 1px 3px rgba(0,0,0,.1)" : "none",
                transition: "all 0.2s"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div style={{ flex: 1, minWidth: 200, background: "#fff", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <Icon name="search" size={16} color={COLORS.muted} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students..." style={{ border: "none", outline: "none", flex: 1, fontSize: 13 }} />
        </div>
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{
          background: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13,
          boxShadow: "0 1px 3px rgba(0,0,0,.08)", cursor: "pointer"
        }}>
          <option>All</option>
          {dbClasses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        {/* Only show Add Student if Admin, Principal, Deputy, or the Class Teacher (further verified in DB) */}
        {["admin", "principal", "deputy", "teacher"].includes(role) && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleExportCSV} style={{ background: COLORS.paper, color: COLORS.forest, border: `1px solid ${COLORS.forest}40`, borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="download" size={14} color={COLORS.forest} /> Export CSV
            </button>
            <button onClick={() => setShowAdd(!showAdd)} style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="add" size={14} color="#fff" /> Add Student
            </button>
          </div>
        )}
      </div>

      {/* Add New Student Form */}
      {showAdd && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,.12)", border: `2px solid ${COLORS.forest}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: COLORS.forest }}>➕ Register New Student</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Admission Number</label>
              <input value={newAdm} onChange={e=>setNewAdm(e.target.value)} placeholder="e.g ADM2026111" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Full Name</label>
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Student Name" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Class</label>
              <select value={newClassId} onChange={e=>setNewClassId(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box" }}>
                <option value="">-- Select Class --</option>
                {dbClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={handleAddStudent} style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, cursor: "pointer" }}>Register Student</button>
            <button onClick={() => setShowAdd(false)} style={{ background: COLORS.cream, border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: COLORS.cream }}>
              {["ADM Number", "Student Name", "Class", "Balance", "Status", "Actions"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: COLORS.muted }}>Loading students from Database...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: COLORS.muted }}>No {viewFilter} students found.</td></tr>
            ) : filtered.map((s, i) => (
              <tr key={s.adm} style={{ borderBottom: "1px solid #F3F4F6", transition: "background 0.15s", opacity: s.status !== 'active' ? 0.6 : 1 }}
                onMouseEnter={e => e.currentTarget.style.background = COLORS.cream}
                onMouseLeave={e => e.currentTarget.style.background = "#fff"}
              >
                <td style={{ padding: "12px 16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.forest, fontWeight: 600 }}>{s.adm}</td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.forest, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                      {s.name[0]}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 16px" }}><Badge type="info">{s.class}</Badge></td>
                <td style={{ padding: "12px 16px" }}>
                  {s.balance === 0 ? <Badge type="success">Paid</Badge> : <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: s.balance > 10000 ? COLORS.red : "#d97706" }}>KSh {s.balance.toLocaleString()}</span>}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ 
                     fontSize: 12, fontWeight: 700, 
                     color: s.status === 'active' ? COLORS.forest : (s.status === 'suspended' ? '#d97706' : (s.status === 'expelled' ? COLORS.red : COLORS.muted))
                   }}>
                     {String(s.status).charAt(0).toUpperCase() + String(s.status).slice(1)}
                   </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <button onClick={() => handleOpenDetails(s)} style={{ background: COLORS.sky, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>View</button>
                    {["admin", "principal", "deputy", "teacher"].includes(role) && (
                      <>
                        {s.status === 'active' ? (
                          <>
                            <button onClick={() => handleUpdateStatus(s.id, 'suspended')} style={{ background: "#FEF2F2", color: COLORS.red, border: `1px solid ${COLORS.red}30`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Suspend</button>
                            <button onClick={() => handleUpdateStatus(s.id, 'expelled')} style={{ background: COLORS.red, color: "#fff", border: `1px solid ${COLORS.red}30`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Expel</button>
                            <button onClick={() => handleUpdateStatus(s.id, 'archived')} style={{ background: COLORS.paper, color: COLORS.charcoal, border: `1px solid ${COLORS.muted}50`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Archive</button>
                          </>
                        ) : (
                          <button onClick={() => handleUpdateStatus(s.id, 'active')} style={{ background: "#F0FDF4", color: COLORS.forest, border: `1px solid ${COLORS.forest}30`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Re-activate</button>
                        )}
                        {['archived', 'expelled'].includes(s.status) && role === 'admin' && (
                          <button onClick={() => handleDeleteStudent(s.id, s.profile_id, s.name)} style={{ background: COLORS.red, color: "#fff", border: `1px solid ${COLORS.red}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Delete</button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && (
          <div style={{ padding: "12px 16px", fontSize: 12, color: COLORS.muted, borderTop: "1px solid #F3F4F6" }}>
            Showing {filtered.length} students
          </div>
        )}
      </div>

      {selectedStudent && (
        <div 
          onClick={() => setSelectedStudent(null)}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.2)", position: "relative" }}
          >
            {/* Header */}
            <div style={{ padding: 24, background: COLORS.forest, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fff", color: COLORS.forest, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900 }}>
                  {selectedStudent.name[0]}
                </div>
                <div>
                   <h2 style={{ margin: 0, fontSize: 18 }}>{selectedStudent.name}</h2>
                   <div style={{ fontSize: 12, opacity: 0.8, fontFamily: "monospace" }}>{selectedStudent.adm} • {selectedStudent.class}</div>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} style={{ background: "rgba(255,255,255,0.2)", borderRadius: '50%', border: "none", cursor: "pointer", padding: 8, display: 'flex' }}>
                 <Icon name="close" size={20} color="#fff" />
              </button>
            </div>

            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Status Section */}
              <div style={{ background: COLORS.paper, padding: 16, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <div>
                   <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", marginBottom: 4 }}>Lifecycle Status</div>
                   <Badge type={selectedStudent.status === 'active' ? 'success' : 'danger'}>{selectedStudent.status.toUpperCase()}</Badge>
                 </div>
                 {selectedStudent.status_reason && (
                   <div style={{ textAlign: "right", maxWidth: "60%" }}>
                     <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", marginBottom: 4 }}>Reason</div>
                     <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.charcoal }}>{selectedStudent.status_reason}</div>
                   </div>
                 )}
              </div>

              {/* Info Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                 <div>
                   <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", marginBottom: 6 }}>Parent / Guardian</div>
                   <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedStudent.details?.parent_contact || "Not Recorded"}</div>
                 </div>
                 <div>
                   <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", marginBottom: 6 }}>Secondary Contact</div>
                   <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedStudent.details?.emergency_contact || "Not Recorded"}</div>
                 </div>
                 <div style={{ gridColumn: "span 2" }}>
                   <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", marginBottom: 6 }}>Academic Remarks</div>
                   <div style={{ fontSize: 14, color: COLORS.charcoal, lineHeight: 1.5, fontStyle: "italic", background: COLORS.cream, padding: 12, borderRadius: 8 }}>
                     {selectedStudent.details?.character_comments || "No academic or character remarks available yet for this student."}
                   </div>
                 </div>
              </div>

              {/* Action Buttons */}
              {role === 'admin' && (
                <div style={{ marginTop: 10, display: "flex", gap: 10, borderTop: "1px solid #EEE", paddingTop: 20 }}>
                   <button 
                     onClick={() => { if(onSelectStudent) onSelectStudent(selectedStudent.id, selectedStudent.adm); }} 
                     style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #E5E7EB", fontWeight: 700, fontSize: 13, cursor: "pointer", background: "#fff", transition: "all 0.2s" }}
                     onMouseEnter={e => e.currentTarget.style.background = COLORS.cream}
                     onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                   >
                     Edit Profile
                   </button>
                   <button onClick={() => window.print()} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: COLORS.forest, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Print Records</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
