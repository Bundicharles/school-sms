"use client";

import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";

export const DepartmentsPage = ({ selectedYear, role }: { selectedYear: string, role: string }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Department Form
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [hodCode, setHodCode] = useState("");

  // New Subject Form
  const [showSubjectAdd, setShowSubjectAdd] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");

  const supabase = createClient();

  const fetchDepartments = async () => {
    setLoading(true);
    // Fetch departments and join the HOD profile name
    const { data: depts } = await supabase.from('departments').select('id, name, code, profiles(full_name)');
    
    if (depts) {
      // For each department, fetch the subjects associated with it
      const mapped = await Promise.all(depts.map(async (d:any) => {
        const { data: subs } = await supabase.from('subjects').select('name').eq('department_id', d.id);
        const { count: teachers } = await supabase.from('subjects') // Mocking teacher count
          .select('id', { count: 'exact', head: true }).eq('department_id', d.id);

        return {
          id: d.id,
          name: d.name,
          code: d.code,
          hod: d.profiles?.full_name || "Unassigned",
          subjects: subs ? subs.map((s:any) => s.name) : [],
          teachers: teachers || 0
        };
      }));
      setDepartments(mapped);
    }
    setLoading(false);
  };

  const fetchStaff = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, code')
      .in('role', ['teacher', 'principal', 'deputy', 'admin'])
      .order('full_name');
    if (data) setAllStaff(data);
  };

  useEffect(() => {
    fetchDepartments();
    fetchStaff();
  }, [supabase]);

  const handleCreateDepartment = async () => {
    if (!name || !code || !hodCode) {
      alert("Please fill all fields for the new department.");
      return;
    }

    // Lookup HOD profile ID first
    const { data: hodProfile } = await supabase.from('profiles').select('id').eq('code', hodCode).single();
    if (!hodProfile) {
      alert("Staff Code not found. Cannot assign HOD.");
      return;
    }

    const { error } = await supabase.from('departments').insert({
      name,
      code,
      hod_id: hodProfile.id
    });

    if (error) {
      alert("Database Error: " + error.message);
    } else {
      alert("Department created successfully!");
      setName(""); setCode(""); setHodCode(""); setShowAdd(false);
      fetchDepartments();
    }
  };

  const handleCreateSubject = async () => {
    if (!subjectName || !selectedDeptId) {
      alert("Please enter a subject name and select a department.");
      return;
    }

    const { error } = await supabase.from('subjects').insert({
      name: subjectName,
      department_id: selectedDeptId
    });

    if (error) {
      alert("Error creating subject: " + error.message);
    } else {
      setSubjectName(""); setShowSubjectAdd(false);
      fetchDepartments();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header Add Button - Admin Only */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
           <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.forest, fontFamily: "'Playfair Display', serif" }}>Departments & Subjects</div>
           <div style={{ fontSize: 13, color: COLORS.muted }}>Organize your academy by departments and academic subjects.</div>
        </div>
        {role === "admin" && (
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => { setShowSubjectAdd(!showSubjectAdd); setShowAdd(false); }} style={{
              background: COLORS.gold, color: "#fff", border: "none", borderRadius: 10,
              padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}>
              <Icon name="add" size={14} color="#fff" /> Add Subject
            </button>
            <button onClick={() => { setShowAdd(!showAdd); setShowSubjectAdd(false); }} style={{
              background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10,
              padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}>
              <Icon name="add" size={14} color="#fff" /> Add Department
            </button>
          </div>
        )}
      </div>

      {/* Add New Dept Form */}
      {showAdd && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,.12)", border: `2px solid ${COLORS.forest}`, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.forest }}>➕ Register New Department</div>
            <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
              <Icon name="close" size={20} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Department Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Sciences" style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Code</label>
              <input value={code} onChange={e=>setCode(e.target.value)} placeholder="e.g. SCI" style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>HOD (Staff Member)</label>
              <select 
                value={hodCode || ""} 
                onChange={e => setHodCode(e.target.value)} 
                style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box", background: "#fff" }}
              >
                <option value="">-- Select Staff --</option>
                {allStaff.map(s => <option key={s.id} value={s.code}>{s.full_name} ({s.code})</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={handleCreateDepartment} style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer" }}>Save Department</button>
            <button onClick={() => setShowAdd(false)} style={{ background: COLORS.cream, border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add New Subject Form */}
      {showSubjectAdd && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,.12)", border: `2px solid ${COLORS.gold}`, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.gold }}>📚 Add New Academic Subject</div>
            <button onClick={() => setShowSubjectAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
              <Icon name="close" size={20} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Subject Name</label>
              <input value={subjectName} onChange={e=>setSubjectName(e.target.value)} placeholder="e.g. Biology" style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Assign to Department</label>
              <select 
                value={selectedDeptId} 
                onChange={e=>setSelectedDeptId(e.target.value)} 
                style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid #E5E7EB`, fontSize: 13, boxSizing: "border-box", background: "#fff" }}
              >
                <option value="">-- Select Department --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={handleCreateSubject} style={{ background: COLORS.gold, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer" }}>Create Subject</button>
            <button onClick={() => setShowSubjectAdd(false)} style={{ background: COLORS.cream, border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Grid of Departments */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>Fetching Database Departments...</div>
      ) : departments.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>No departments have been initialized in the database yet. Click "Add Department" to start.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {departments.map(d => (
            <div key={d.id} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)", borderTop: `4px solid ${COLORS.forest}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.gold, fontWeight: 700, letterSpacing: "0.1em" }}>{d.code}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: COLORS.charcoal }}>{d.name}</div>
                </div>
                <button style={{ background: "none", border: `1px solid #E5E7EB`, borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}>
                  <Icon name="pencil" size={14} color={COLORS.muted} />
                </button>
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>HOD:</span> {d.hod}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {d.subjects.map((s: string) => <Badge key={s} type="info">{s}</Badge>)}
                {d.subjects.length === 0 && <span style={{ fontSize: 12, color: COLORS.muted }}>No subjects assigned yet</span>}
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: COLORS.muted, paddingTop: 12, borderTop: "1px solid #F3F4F6" }}>
                <span>👨‍🏫 {d.teachers} Teachers assigned</span>
                <span>📚 {d.subjects.length} Subjects</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
