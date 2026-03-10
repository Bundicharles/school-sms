"use client";

import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/constants";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/utils/supabase/client";

export const DeanPage = ({ role, code, selectedYear }: { role: string; code: string; selectedYear: string }) => {
  const [activeTab, setActiveTab] = useState("exams");
  const [loading, setLoading] = useState(true);

  // Exam Workflow State
  const [exams, setExams] = useState<any[]>([]);
  const [newExamTitle, setNewExamTitle] = useState("");
  const [newExamYear, setNewExamYear] = useState(new Date().getFullYear().toString());
  const [newExamTerm, setNewExamTerm] = useState("Term 1");

  // Performance State
  const [selectedExamId, setSelectedExamId] = useState("");
  const [streamAverages, setStreamAverages] = useState<any[]>([]);

  // Documents State
  const [documents, setDocuments] = useState<any[]>([]);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("Exam Paper");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docExamId, setDocExamId] = useState("");

  // Registry State
  const [departments, setDepartments] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  // Duty Roster State
  const [dutyRoster, setDutyRoster] = useState<any[]>([]);
  const [dutyWeekStart, setDutyWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(d.setDate(diff));
  });

  // Transition State
  const [activeYear, setActiveYear] = useState<any>(null);
  const [allYears, setAllYears] = useState<any[]>([]);
  const [newYearInput, setNewYearInput] = useState(new Date().getFullYear().toString());
  const [promoting, setPromoting] = useState(false);
  const [promotionReport, setPromotionReport] = useState<string[]>([]);
  const [promotionLogs, setPromotionLogs] = useState<any[]>([]);

  const getWeekDates = (start: Date) => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const weekDates = getWeekDates(dutyWeekStart);

  // Timetable State
  const [timetableData, setTimetableData] = useState<any[]>([]);
  const [selectedTimetableClass, setSelectedTimetableClass] = useState("");
  const [selectedTimetableTeacher, setSelectedTimetableTeacher] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch Exams for selected Year
    const { data: eData } = await supabase.from('exams').select('*').eq('academic_year', selectedYear).order('created_at', { ascending: false });
    if (eData) {
      setExams(eData);
      if (eData.length > 0 && !selectedExamId) setSelectedExamId(eData[0].id);
    }

    // Fetch Academic Documents
    const { data: dData } = await supabase.from('documents')
      .select('*, exams(title)')
      .in('document_type', ['Exam Paper', 'Marking Scheme', 'Syllabus'])
      .order('created_at', { ascending: false });
    if (dData) setDocuments(dData);

    // Fetch Departments
    const { data: deptData } = await supabase.from('departments').select('*, profiles(full_name)').order('name');
    if (deptData) setDepartments(deptData);

    // Fetch All Classes
    const { data: clsData } = await supabase.from('classes').select('*, profiles(full_name)').order('name');
    if (clsData) setAllClasses(clsData);

    // Fetch All Students
    const { data: stData } = await supabase.from('students').select('*, profiles(full_name, code), classes(name)');
    if (stData) setAllStudents(stData);

    // Fetch Duty Roster
    const { data: rosterData } = await supabase.from('duty_roster').select('*, profiles(full_name, code)').order('duty_date', { ascending: false });
    if (rosterData) setDutyRoster(rosterData);

    // Fetch Timetable Data
    const { data: tData } = await supabase.from('timetable_slots').select('*, classes(name), profiles(full_name)');
    if (tData) setTimetableData(tData);

    // Fetch Active Academic Year
      const { data: years } = await supabase.from('academic_years').select('*').order('year', { ascending: false });
      if (years) {
        setAllYears(years);
        const active = years.find(y => y.is_active);
        if (active) setActiveYear(active);
      }
    
    // Fetch Promotion Logs
    const { data: logs } = await supabase
      .from('promotion_log')
      .select('*, students(profiles(full_name, code)), from_classes:classes!promotion_log_from_class_id_fkey(name), to_classes:classes!promotion_log_to_class_id_fkey(name)')
      .order('promoted_at', { ascending: false });
    if (logs) setPromotionLogs(logs);

    setLoading(false);
  };

  // --------------------------------------------------------------------------
  // EXAM MANAGEMENT LOGIC
  // --------------------------------------------------------------------------
  const handleCreateExam = async () => {
    if (!newExamTitle.trim() || !newExamYear || !newExamTerm) {
      return alert("Please fill all details for the new exam.");
    }
    setLoading(true);
    
    // Get Admin Profile ID
    const { data: { user } } = await supabase.auth.getUser(); // might be null in open mode
    // We will leave created_by null if open mode, or rely on RLS disabled.
    
    const { error } = await supabase.from('exams').insert({
      title: newExamTitle.trim(),
      academic_year: newExamYear,
      term: newExamTerm,
      status: 'upcoming'
    });

    if (error) alert("Error creating exam: " + error.message);
    else {
      alert("Exam Created! Teachers can now enter marks for it once you set it to Active.");
      setNewExamTitle("");
      await fetchData();
    }
    setLoading(false);
  };

  const updateExamStatus = async (examId: string, newStatus: string) => {
    setLoading(true);
    const { error } = await supabase.from('exams').update({ status: newStatus }).eq('id', examId);
    if (error) alert(error.message);
    await fetchData();
  };

  const deleteExam = async (examId: string) => {
    if (!confirm("Are you sure? This will hide the exam. Make sure no marks are critical before deleting.")) return;
    setLoading(true);
    const { error } = await supabase.from('exams').delete().eq('id', examId);
    if (error) alert("Error: " + error.message);
    await fetchData();
  };

  // --------------------------------------------------------------------------
  // PERFORMANCE CALCULATION LOGIC
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab === "performance" && selectedExamId) {
      calculatePerformance(selectedExamId);
    }
  }, [activeTab, selectedExamId]);

  const calculatePerformance = async (examId: string) => {
    // 1. Fetch all results linked to this exam_id
    // If we haven't linked results via exam_id yet (since we just added it), we might fallback
    // For now, we query purely by exam_id
    const { data: resData } = await supabase
      .from('results')
      .select('score, students(class_id, classes(name, level))')
      .eq('exam_id', examId);
      
    if (!resData || resData.length === 0) {
      setStreamAverages([]);
      return;
    }

    // Process averages grouped by Class (Stream)
    const streamMap: Record<string, { totalScores: number, count: number, level: string }> = {};
    
    resData.forEach((r: any) => {
      const student = Array.isArray(r.students) ? r.students[0] : r.students;
      const cls = student ? (Array.isArray(student.classes) ? student.classes[0] : student.classes) : null;
      
      if (!cls || r.score == null) return;
      const className = cls.name;
      const level = cls.level;
      
      if (!streamMap[className]) streamMap[className] = { totalScores: 0, count: 0, level };
      streamMap[className].totalScores += r.score;
      streamMap[className].count += 1;
    });

    const formattedAverages = Object.keys(streamMap).map(className => ({
      className,
      level: streamMap[className].level,
      average: (streamMap[className].totalScores / streamMap[className].count).toFixed(2),
      entries: streamMap[className].count
    })).sort((a,b) => b.average.localeCompare(a.average)); // Sort highest avg first

    setStreamAverages(formattedAverages);
  };

  // --------------------------------------------------------------------------
  // DOCUMENT VAULT LOGIC (ACADEMIC)
  // --------------------------------------------------------------------------
  const handleUploadDocument = async () => {
    if (!docTitle || !docFile) return alert("Please provide a title and select a file.");
    setUploadingDoc(true);

    try {
      const fileExt = docFile.name.split('.').pop() || 'pdf';
      const fileName = `academic_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `vault/${fileName}`;

      const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, docFile, {
         cacheControl: '3600',
         upsert: false
      });
      
      if (uploadErr) {
        setUploadingDoc(false);
        return alert("Failed to upload. Ensure the Supabase Storage Bucket 'documents' exists. " + uploadErr.message);
      }

      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(filePath);

      const { error: dbErr } = await supabase.from('documents').insert({
        title: docTitle,
        document_type: docType,
        file_url: publicUrlData.publicUrl,
        exam_id: selectedExamId || null
      });

      if (dbErr) alert("Error saving document info: " + dbErr.message);
      else {
        alert("Academic Document Uploaded!");
        setDocTitle("");
        setDocFile(null);
        await fetchData();
      }
    } catch (e: any) {
      alert("An unexpected error occurred: " + e.message);
    }
    setUploadingDoc(false);
  };

  // --------------------------------------------------------------------------
  // ANNUAL TRANSITION LOGIC
  // --------------------------------------------------------------------------
  const handleAnnualPromotion = async () => {
    if (!activeYear) return alert("No active academic year found.");
    if (!confirm(`CRITICAL: You are about to promote ALL students to the next level for the upcoming year. \n\n- Students in Form 4 will be ARCHIVED.\n- Students in Form 1-3 will move to the next level.\n- This action is permanent. Proceed?`)) return;

    setPromoting(true);
    const report: string[] = [];
    
    try {
      // 1. Fetch Students with current level info
      const { data: students, error: stErr } = await supabase
        .from('students')
        .select('id, profile_id, class_id, classes(name, level), profiles(full_name, code)');
      
      if (stErr || !students) throw new Error("Failed to fetch students: " + stErr?.message);

      // 2. Fetch All Classes for target mapping
      const { data: classes, error: clsErr } = await supabase.from('classes').select('id, name, level');
      if (clsErr || !classes) throw new Error("Failed to fetch classes: " + clsErr?.message);

      let archivedCount = 0;
      let promotedCount = 0;

      for (const st of (students as any[])) {
        const cls = Array.isArray(st.classes) ? st.classes[0] : st.classes;
        const prof = Array.isArray(st.profiles) ? st.profiles[0] : st.profiles;
        
        const currentLevel = cls?.level;
        const className = cls?.name;

        if (currentLevel === "4") {
          // ARCHIVE FORM 4
          await supabase.from('students').update({ status: 'archived', status_reason: `Graduated class of ${activeYear.year}` }).eq('id', st.id);
          await supabase.from('profiles').update({ status: 'archived' }).eq('id', st.profile_id);
          report.push(`✅ [Archived] ${prof?.full_name} (${prof?.code}) - Graduated Form 4`);
          archivedCount++;
        } else if (["1", "2", "3"].includes(currentLevel)) {
          // PROMOTE FORM 1-3
          const nextLevel = (parseInt(currentLevel) + 1).toString();
          
          // Try to find matching stream in next level (e.g. 1A -> 2A)
          // Look for class names that contain the target level and the same suffix
          // Suffix is usually the last character or everything after "Form X"
          const suffix = className.includes("Form") ? className.split(" ").pop()?.replace(currentLevel, "") : className.replace(currentLevel, "");
          
          const targetClass = classes.find(c => 
            c.level === nextLevel && 
            (c.name.includes(suffix || "###RANDOM###") || (suffix && c.name.endsWith(suffix)))
          );

          if (targetClass) {
            await supabase.from('students').update({ class_id: targetClass.id }).eq('id', st.id);
            
            // Log the promotion
            await supabase.from('promotion_log').insert({
              student_id: st.id,
              from_class_id: st.class_id,
              to_class_id: targetClass.id,
              from_level: currentLevel,
              to_level: nextLevel,
              academic_year: activeYear.year
            });
            report.push(`✅ [Promoted] ${prof?.full_name} - Form ${currentLevel} ➔ Form ${nextLevel} (${targetClass.name})`);
            promotedCount++;
          } else {
            report.push(`⚠️ [Manual Required] ${prof?.full_name} - No Form ${nextLevel} class found matching stream "${suffix}".`);
          }
        }
      }

      // 3. Mark the current year as closed and create next year (optional automation)
      // For now we just alert completion
      alert(`Promotion Complete!\n\n- ${archivedCount} Students Graduated/Archived\n- ${promotedCount} Students Promoted\n\nCheck the report for details.`);
      setPromotionReport(report);
      await fetchData();
    } catch (err: any) {
      alert("Error during promotion: " + err.message);
    }
    setPromoting(false);
  };


  const handleAddYear = async () => {
    if (!newYearInput) return;
    const { error } = await supabase.from('academic_years').insert({ year: newYearInput, is_active: false });
    if (error) alert("Error adding year: " + error.message);
    else {
      alert(`Academic Year ${newYearInput} Added!`);
      await fetchData();
    }
  };

  const handleSetActiveYear = async (year: string) => {
    if (!confirm(`Set ${year} as the active academic year? This will deactivate all other years.`)) return;
    
    // Deactivate all first
    const { error: deactiveErr } = await supabase.from('academic_years').update({ is_active: false }).neq('year', '###NONE###');
    if (deactiveErr) return alert("Error deactivating years: " + deactiveErr.message);

    // Activate selected
    const { error: activeErr } = await supabase.from('academic_years').update({ is_active: true }).eq('year', year);
    if (activeErr) alert("Error activating year: " + activeErr.message);
    else {
      alert(`${year} is now ACTIVE.`);
      await fetchData();
    }
  };


  if (!["admin", "principal", "deputy", "dean"].includes(role)) {
    return <div style={{ padding: 40, textAlign: "center", color: COLORS.red }}>⚠️ Access Denied. Dean Privileges Required.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Navigation Tabs */}
      <div style={{ display: "flex", gap: 8, background: COLORS.paper, padding: "6px", borderRadius: 12, border: "1px solid #E5E7EB", overflowX: "auto" }}>
        {[
          { id: "exams", label: "🏫 Exam Management" },
          { id: "performance", label: "📊 Stream Analytics" },
          { id: "duty", label: "👮 Duty Roster" },
          { id: "timetables", label: "📅 Timetables" },
          { id: "registry", label: "🏢 School Registry" },
          { id: "resources", label: "📚 Academic Vault" },
          { id: "transition", label: "🔄 Annual Transition" }
        ].map(t => (
          <button 
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{ 
              padding: "10px 20px", borderRadius: 8, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", whiteSpace: "nowrap",
              background: activeTab === t.id ? "#fff" : "transparent",
              color: activeTab === t.id ? COLORS.charcoal : COLORS.muted,
              boxShadow: activeTab === t.id ? "0 2px 4px rgba(0,0,0,0.05)" : "none"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 20, color: COLORS.muted }}>Processing...</div>}

      {/* TAB: EXAMS */}
      {activeTab === "exams" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", borderTop: `4px solid ${COLORS.forest}`, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <SectionHeader title="📝 Orchestrate New Exam" />
              <button 
                onClick={() => {
                  setNewExamTitle("");
                  // In this case, simply clearing the title is like "closing" the intent if it's always visible.
                  // But if there's no way to 'hide' it, maybe just clearing the inputs is fine.
                  // Actually, if it's always expanded, an X might just clear the form.
                }} 
                style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 16 }}>Set up an official exam. Teachers will only be able to enter marks when the status is set to 'Active'.</p>
            
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Official Exam Title</label>
                <input value={newExamTitle} onChange={e=>setNewExamTitle(e.target.value)} type="text" placeholder="e.g. Term 2 Mid-Term CAT" style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #E5E7EB" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Academic Year</label>
                <select value={newExamYear} onChange={e=>setNewExamYear(e.target.value)} style={{ padding: 12, borderRadius: 8, border: "1px solid #E5E7EB", width: 120 }}>
                  <option>2024</option>
                  <option>2025</option>
                  <option>2026</option>
                  <option>2027</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Term</label>
                <select value={newExamTerm} onChange={e=>setNewExamTerm(e.target.value)} style={{ padding: 12, borderRadius: 8, border: "1px solid #E5E7EB", width: 120 }}>
                  <option>Term 1</option>
                  <option>Term 2</option>
                  <option>Term 3</option>
                </select>
              </div>
              <button onClick={handleCreateExam} style={{ padding: "12px 24px", background: COLORS.forest, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Create Exam</button>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
             <SectionHeader title="📋 Configured Examinations" />
             <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
               <thead>
                 <tr style={{ background: COLORS.cream }}>
                   <th style={{ padding: "12px", textAlign: "left", fontSize: 12, color: COLORS.muted }}>Exam Title</th>
                   <th style={{ padding: "12px", textAlign: "left", fontSize: 12, color: COLORS.muted }}>Period</th>
                   <th style={{ padding: "12px", textAlign: "left", fontSize: 12, color: COLORS.muted }}>Status</th>
                   <th style={{ padding: "12px", textAlign: "right", fontSize: 12, color: COLORS.muted }}>Actions</th>
                 </tr>
               </thead>
               <tbody>
                 {exams.length === 0 ? <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: COLORS.muted, fontStyle: "italic" }}>No exams configured.</td></tr> : null}
                 {exams.map(e => (
                   <tr key={e.id} style={{ borderBottom: "1px solid #E5E7EB" }}>
                     <td style={{ padding: "12px", fontSize: 14, fontWeight: 600, color: COLORS.charcoal }}>{e.title}</td>
                     <td style={{ padding: "12px", fontSize: 13, color: COLORS.muted }}>{e.term}, {e.academic_year}</td>
                     <td style={{ padding: "12px" }}>
                        <Badge type={e.status === 'active' ? 'success' : e.status === 'closed' ? 'danger' : 'warning'}>{e.status.toUpperCase()}</Badge>
                     </td>
                     <td style={{ padding: "12px", textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                       {e.status === 'upcoming' && <button onClick={() => updateExamStatus(e.id, 'active')} style={{ padding: "6px 12px", background: "#D1FAE5", color: "#059669", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Start Exam</button>}
                       {e.status === 'active' && <button onClick={() => updateExamStatus(e.id, 'closed')} style={{ padding: "6px 12px", background: "#FEE2E2", color: "#B91C1C", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Close Marks Entry</button>}
                       {e.status === 'closed' && <button onClick={() => updateExamStatus(e.id, 'active')} style={{ padding: "6px 12px", background: "#F3F4F6", color: "#4B5563", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Reopen</button>}
                       <button onClick={() => deleteExam(e.id)} style={{ padding: "6px 12px", background: "transparent", color: COLORS.red, border: "1px solid #FECACA", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Delete</button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </div>
      )}

      {/* TAB: PERFORMANCE */}
      {activeTab === "performance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
               <SectionHeader title="📊 Stream Analytics (Class Averages)" />
               <select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)} style={{ padding: '10px', borderRadius: 8, border: '1px solid #E5E7EB', fontWeight: 600 }}>
                 <option value="">Select Exam to Analyze...</option>
                 {exams.map(e => <option key={e.id} value={e.id}>{e.title} ({e.academic_year})</option>)}
               </select>
            </div>

            {streamAverages.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", borderRadius: 12, background: "#F9FAFB", border: "1px solid #E5E7EB", color: COLORS.muted }}>
                No score entries found for this specific exam yet. (Note: Only marks entered against configured exams via the new system will appear here).
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {streamAverages.map((sa, i) => (
                  <div key={sa.className} style={{ 
                    padding: 20, borderRadius: 12, border: "1px solid #E5E7EB", background: i === 0 ? "#F0FDF4" : "#fff",
                    boxShadow: i === 0 ? "0 4px 12px rgba(22,163,74,0.1)" : "none"
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase" }}>FORM {sa.level}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.charcoal, marginBottom: 8 }}>{sa.className}</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: i === 0 ? "#16A34A" : COLORS.sky }}>{sa.average}%</div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>{sa.entries} individual marks entered</div>
                    {i === 0 && <div style={{ marginTop: 8, fontSize: 12, color: "#166534", fontWeight: 700 }}>🏆 Top Performing Stream</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: DUTY ROSTER */}
      {activeTab === "duty" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <SectionHeader title="👮 Official Duty Roster" />
              <div style={{ display: "flex", gap: 8, alignItems: "center", background: COLORS.paper, padding: 4, borderRadius: 10 }}>
                <button 
                  onClick={() => {
                    const d = new Date(dutyWeekStart);
                    d.setDate(d.getDate() - 7);
                    setDutyWeekStart(d);
                  }}
                  style={{ padding: "6px 12px", border: "none", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                >
                  ◀ Previous Week
                </button>
                <div style={{ fontSize: 13, fontWeight: 800, padding: "0 10px", color: COLORS.forest }}>
                  {weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <button 
                  onClick={() => {
                    const d = new Date(dutyWeekStart);
                    d.setDate(d.getDate() + 7);
                    setDutyWeekStart(d);
                  }}
                  style={{ padding: "6px 12px", border: "none", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                >
                  Next Week ▶
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #E5E7EB" }}>
                <thead>
                  <tr style={{ background: COLORS.paper }}>
                    <th style={{ padding: "15px", border: "1px solid #E5E7EB", width: 150, textAlign: "left", fontSize: 12, color: COLORS.muted }}>DAY / DATE</th>
                    <th style={{ padding: "15px", border: "1px solid #E5E7EB", textAlign: "center", fontSize: 12, color: COLORS.muted }}>☀️ DAY SHIFT</th>
                    <th style={{ padding: "15px", border: "1px solid #E5E7EB", textAlign: "center", fontSize: 12, color: COLORS.muted }}>🌙 NIGHT SHIFT</th>
                  </tr>
                </thead>
                <tbody>
                  {weekDates.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const dayDuty = dutyRoster.find(r => r.duty_date === dateStr && r.shift === 'Day');
                    const nightDuty = dutyRoster.find(r => r.duty_date === dateStr && r.shift === 'Night');
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;

                    return (
                      <tr key={dateStr} style={{ background: isToday ? "#F0FDF4" : "#fff" }}>
                        <td style={{ padding: "15px", border: "1px solid #E5E7EB", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: isToday ? COLORS.forest : COLORS.charcoal }}>
                            {date.toLocaleDateString(undefined, { weekday: 'long' })}
                          </div>
                          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                            {date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            {isToday && <span style={{ marginLeft: 8, fontSize: 9, background: COLORS.forest, color: "#fff", padding: "2px 6px", borderRadius: 10 }}>TODAY</span>}
                          </div>
                        </td>
                        <td style={{ padding: "15px", border: "1px solid #E5E7EB", verticalAlign: "top", textAlign: "center", height: 100 }}>
                          {dayDuty ? (
                            <div style={{ animation: "fadeIn 0.3s ease" }}>
                              {(() => {
                                const prof = Array.isArray(dayDuty.profiles) ? dayDuty.profiles[0] : dayDuty.profiles;
                                return (
                                  <>
                                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: COLORS.sky + "20", color: COLORS.sky, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, margin: "0 auto 8px" }}>
                                      {prof?.full_name?.[0] || "?"}
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.charcoal }}>{prof?.full_name}</div>
                                    <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>Code: {prof?.code}</div>
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#D1D5DB", fontStyle: "italic", marginTop: 20 }}>No Duty Assigned</div>
                          )}
                        </td>
                        <td style={{ padding: "15px", border: "1px solid #E5E7EB", verticalAlign: "top", textAlign: "center", height: 100 }}>
                          {nightDuty ? (
                            <div style={{ animation: "fadeIn 0.3s ease" }}>
                              {(() => {
                                const prof = Array.isArray(nightDuty.profiles) ? nightDuty.profiles[0] : nightDuty.profiles;
                                return (
                                  <>
                                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: COLORS.gold + "20", color: COLORS.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, margin: "0 auto 8px" }}>
                                      {prof?.full_name?.[0] || "?"}
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.charcoal }}>{prof?.full_name}</div>
                                    <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>Code: {prof?.code}</div>
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#D1D5DB", fontStyle: "italic", marginTop: 20 }}>No Duty Assigned</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 16, fontSize: 12, color: COLORS.muted, fontStyle: "italic" }}>
              * Duty roster updates are managed by the Deputy Principal or Dean. Contact administration to modify assignments.
            </p>
          </div>
        </div>
      )}

      {/* TAB: TIMETABLES */}
      {activeTab === "timetables" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
            <SectionHeader title="📅 Timetable Explorer" />
            <div style={{ display: "flex", gap: 16, marginTop: 16, marginBottom: 24 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", marginBottom: 6, display: "block" }}>View by Class</label>
                <select value={selectedTimetableClass} onChange={e => { setSelectedTimetableClass(e.target.value); setSelectedTimetableTeacher(""); }} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}>
                  <option value="">-- Select Class --</option>
                  {allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", marginBottom: 6, display: "block" }}>View by Teacher</label>
                <select value={selectedTimetableTeacher} onChange={e => { setSelectedTimetableTeacher(e.target.value); setSelectedTimetableClass(""); }} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}>
                  <option value="">-- Select Teacher --</option>
                  {Array.from(new Set(timetableData.filter(t => t.profiles).map(t => JSON.stringify({id: t.teacher_id, name: t.profiles.full_name}))))
                    .map(s => JSON.parse(s))
                    .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {(selectedTimetableClass || selectedTimetableTeacher) ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #E5E7EB" }}>
                  <thead>
                    <tr style={{ background: COLORS.paper }}>
                      <th style={{ padding: "12px", border: "1px solid #E5E7EB", width: 100 }}>Day / Period</th>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(p => <th key={p} style={{ padding: "12px", border: "1px solid #E5E7EB", fontSize: 12 }}>Period {p}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                      <tr key={day}>
                        <td style={{ padding: "12px", border: "1px solid #E5E7EB", fontWeight: 700, fontSize: 13, background: COLORS.cream }}>{day}</td>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(period => {
                          const slot = timetableData.find(t => 
                            t.day === day && 
                            t.period_index === period && 
                            (selectedTimetableClass ? t.class_id === selectedTimetableClass : t.teacher_id === selectedTimetableTeacher)
                          );
                          return (
                            <td key={period} style={{ padding: "8px", border: "1px solid #E5E7EB", height: 80, verticalAlign: "top", background: slot ? "#F0F9FF" : "#fff" }}>
                              {slot ? (
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: 12, color: COLORS.sky }}>{slot.subject_name}</div>
                                  <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 4 }}>
                                    {(() => {
                                      const p = Array.isArray(slot.profiles) ? slot.profiles[0] : slot.profiles;
                                      const c = Array.isArray(slot.classes) ? slot.classes[0] : slot.classes;
                                      return selectedTimetableClass ? `Tr. ${p?.full_name || 'N/A'}` : `Class: ${c?.name || 'N/A'}`;
                                    })()}
                                  </div>
                                </div>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: "center", border: "1px dashed #E5E7EB", borderRadius: 12, color: COLORS.muted }}>
                Select a class or teacher to visualize their timetable.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: SCHOOL REGISTRY */}
      {activeTab === "registry" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Departments */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
            <SectionHeader title="📂 Academic Departments" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginTop: 16 }}>
              {departments.map(d => (
                <div key={d.id} style={{ padding: 20, borderRadius: 12, border: "1px solid #E5E7EB", background: "#fff" }}>
                  <div style={{ fontWeight: 800, color: COLORS.forest, fontSize: 16, marginBottom: 4 }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>Code: {d.code}</div>
                  <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600 }}>HOD: Tr. {d.profiles?.full_name || "Not Assigned"}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Classes & Students */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
            <SectionHeader title="🏢 Classes & Student Enumeration" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {allClasses.map(c => (
                <div key={c.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                  <div 
                    onClick={() => setExpandedClassId(expandedClassId === c.id ? null : c.id)}
                    style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: expandedClassId === c.id ? COLORS.cream : "#fff" }}
                  >
                    <div>
                      <span style={{ fontWeight: 800, fontSize: 16, color: COLORS.charcoal }}>{c.name}</span>
                      <span style={{ marginLeft: 12, fontSize: 12, color: COLORS.muted }}>Teacher: Tr. {c.profiles?.full_name || "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Badge type="info">{allStudents.filter(s => s.class_id === c.id).length} Students</Badge>
                      <span>{expandedClassId === c.id ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  
                  {expandedClassId === c.id && (
                    <div style={{ padding: "0 20px 20px 20px", background: "#fff" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                            <th style={{ padding: "12px 0", textAlign: "left", fontSize: 11, color: COLORS.muted, textTransform: "uppercase" }}>ADM</th>
                            <th style={{ padding: "12px 0", textAlign: "left", fontSize: 11, color: COLORS.muted, textTransform: "uppercase" }}>Full Name</th>
                            <th style={{ padding: "12px 0", textAlign: "right", fontSize: 11, color: COLORS.muted, textTransform: "uppercase" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allStudents.filter(s => s.class_id === c.id).length === 0 ? (
                            <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>No students enrolled.</td></tr>
                          ) : allStudents.filter(s => s.class_id === c.id).map(s => {
                            const prof = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
                            return (
                              <tr key={s.id} style={{ borderBottom: "1px solid #F9FAFB" }}>
                                <td style={{ padding: "10px 0", fontSize: 13, fontFamily: "monospace" }}>{prof?.code}</td>
                                <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 600 }}>{prof?.full_name}</td>
                                <td style={{ padding: "10px 0", textAlign: "right" }}>
                                  <Badge type={s.status === 'active' ? 'success' : 'warning'}>{s.status}</Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: RESOURCES (Academic Document Vault) */}
      {activeTab === "resources" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
             <SectionHeader title="📚 Upload Academic Materials" />
             <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 20 }}>Upload Exam Question Papers, Marking Schemes, and Syllabuses for teachers.</p>
             
             <div style={{ background: COLORS.paper, padding: 20, borderRadius: 14, marginBottom: 24, border: "1px dashed #D1D5DB" }}>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Document Title</label>
                    <input value={docTitle} onChange={e=>setDocTitle(e.target.value)} type="text" placeholder="e.g. Form 4 Mock Chem Paper 1" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }} />
                  </div>
                  <div style={{ width: 160 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Category</label>
                    <select value={docType} onChange={e=>setDocType(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }}>
                      <option>Exam Paper</option>
                      <option>Marking Scheme</option>
                      <option>Syllabus</option>
                    </select>
                  </div>
                  <div style={{ width: 200 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Link to Exam (Optional)</label>
                    <select value={selectedExamId} onChange={e=>setSelectedExamId(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }}>
                      <option value="">-- No specific exam --</option>
                      {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>File to Upload</label>
                    <input type="file" onChange={e => setDocFile(e.target.files ? e.target.files[0] : null)} style={{ padding: "9px" }} />
                  </div>
                  <button onClick={handleUploadDocument} disabled={uploadingDoc} style={{ background: COLORS.sky, color: "#fff", border: "none", borderRadius: 10, padding: "13px 24px", fontWeight: 700, cursor: uploadingDoc ? "wait" : "pointer" }}>
                    {uploadingDoc ? "Uploading..." : "Publish Document"}
                  </button>
                </div>
             </div>

             {/* Document List */}
             <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
               {documents.length === 0 ? (
                 <div style={{ padding: 32, textAlign: "center", color: COLORS.muted, fontSize: 13, background: "#F9FAFB", borderRadius: 12, gridColumn: "1 / -1", border: "1px solid #E5E7EB" }}>
                    No academic materials have been uploaded yet.
                 </div>
               ) : documents.map(d => (
                 <div key={d.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, background: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                   <div>
                     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                       <Badge type={d.document_type === 'Exam Paper' ? 'danger' : 'info'}>{d.document_type}</Badge>
                       <span style={{ fontSize: 11, color: COLORS.muted }}>{new Date(d.created_at).toLocaleDateString()}</span>
                     </div>
                     <h4 style={{ margin: "0 0 8px 0", color: COLORS.charcoal, fontSize: 15 }}>{d.title}</h4>
                     {d.exam_id && <div style={{ fontSize: 12, color: COLORS.sky, fontWeight: 600 }}>Linked to: {exams.find(e => e.id === d.exam_id)?.title || 'Unknown Exam'}</div>}
                   </div>
                   <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                     <a href={d.file_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: "center", background: "#F0F9FF", color: "#0369A1", border: "1px solid #BAE6FD", textDecoration: "none", padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                       Download/View
                     </a>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* TAB: ANNUAL TRANSITION */}
      {activeTab === "transition" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", borderTop: `4px solid ${COLORS.gold}` }}>
             <SectionHeader title="🔄 Annual Academic Transition Portal" />
             <div style={{ display: "flex", gap: 24, marginTop: 20 }}>
               <div style={{ flex: 1 }}>
                 <h4 style={{ margin: "0 0 12px 0", color: COLORS.charcoal }}>About the Transition</h4>
                 <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: "1.6" }}>
                   This process transitions the school into the next academic year. 
                 </p>
                 <ul style={{ fontSize: 13, color: COLORS.muted, lineHeight: "1.8", paddingLeft: 20 }}>
                   <li><strong>Form 4 (Finalists)</strong>: Automatically moved to <strong>Archived/Alumni</strong>.</li>
                   <li><strong>Form 1, 2, 3</strong>: Automatically promoted to the next Form (Level + 1).</li>
                   <li><strong>Stream Mapping</strong>: Tries to keep students in the same stream (e.g. 1A ➔ 2A).</li>
                   <li><strong>Auditing</strong>: Every move is logged in the system for historical accountability.</li>
                 </ul>
               </div>
               
               <div style={{ width: 300, background: COLORS.paper, padding: 24, borderRadius: 16, border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                 <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", marginBottom: 8 }}>Current Active Year</div>
                 <div style={{ fontSize: 32, fontWeight: 900, color: COLORS.forest }}>{activeYear?.year || "Not Set"}</div>
                 <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>Status: {activeYear?.is_active ? "🟢 ACTIVE" : "🔴 CLOSED"}</div>
                 
                 <button 
                  onClick={handleAnnualPromotion}
                  disabled={promoting}
                  style={{ 
                    marginTop: 24, width: "100%", padding: "16px", borderRadius: 12, border: "none", 
                    background: COLORS.gold, color: "#fff", fontWeight: 800, cursor: promoting ? "wait" : "pointer",
                    boxShadow: "0 4px 12px rgba(212,175,55,0.2)"
                  }}
                 >
                   {promoting ? "Processing..." : "🚀 START PROMOTION"}
                 </button>
               </div>
             </div>

             {promotionReport.length > 0 && (
               <div style={{ marginTop: 32, padding: 24, background: "#1F2937", borderRadius: 12, maxHeight: 400, overflowY: "auto" }}>
                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h4 style={{ margin: 0, color: "#fff" }}>Promotion Execution Log</h4>
                    <button onClick={() => setPromotionReport([])} style={{ background: "transparent", color: "#9CA3AF", border: "none", fontSize: 12, cursor: "pointer" }}>Clear Log</button>
                 </div>
                 <div style={{ fontFamily: "monospace", fontSize: 12, color: "#D1D5DB", display: "flex", flexDirection: "column", gap: 4 }}>
                   {promotionReport.map((line, i) => (
                     <div key={i}>{line}</div>
                   ))}
                 </div>
               </div>
             )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
               <SectionHeader title="📅 Manage Academic Years" />
               <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 16 }}>Created and activate school years.</p>
               
               <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                 <input 
                  type="text" 
                  value={newYearInput} 
                  onChange={e => setNewYearInput(e.target.value)}
                  placeholder="e.g. 2024"
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #E5E7EB", outline: "none" }}
                 />
                 <button onClick={handleAddYear} style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", fontWeight: 700, cursor: "pointer" }}>+ Add Year</button>
               </div>

               <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                 {allYears.map(y => (
                   <div key={y.id} style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", background: y.is_active ? COLORS.cream : "#fff" }}>
                     <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.charcoal }}>{y.year}</div>
                     <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {y.is_active ? (
                          <Badge type="success">Active</Badge>
                        ) : (
                          <button onClick={() => handleSetActiveYear(y.year)} style={{ background: "transparent", color: COLORS.sky, border: `1px solid ${COLORS.sky}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Set Active</button>
                        )}
                     </div>
                   </div>
                 ))}
               </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column" }}>
               <SectionHeader title="📜 Historical Promotion Records" />
               <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 8, marginBottom: 16 }}>View audits of past student promotions across academic years.</p>
               
               <div style={{ flex: 1, overflowY: "auto", maxHeight: 400, border: "1px solid #E5E7EB", borderRadius: 12 }}>
                 <table style={{ width: "100%", borderCollapse: "collapse" }}>
                   <thead style={{ position: "sticky", top: 0, background: "#F9FAFB", zIndex: 1 }}>
                     <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
                       <th style={{ padding: "12px", textAlign: "left", fontSize: 11, color: COLORS.muted, textTransform: "uppercase" }}>Date</th>
                       <th style={{ padding: "12px", textAlign: "left", fontSize: 11, color: COLORS.muted, textTransform: "uppercase" }}>Student</th>
                       <th style={{ padding: "12px", textAlign: "left", fontSize: 11, color: COLORS.muted, textTransform: "uppercase" }}>Transition</th>
                       <th style={{ padding: "12px", textAlign: "left", fontSize: 11, color: COLORS.muted, textTransform: "uppercase" }}>Year</th>
                     </tr>
                   </thead>
                   <tbody>
                     {promotionLogs.length === 0 ? (
                       <tr>
                         <td colSpan={4} style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
                           No promotion records found in the audit trail.
                         </td>
                       </tr>
                     ) : (
                       promotionLogs.map(log => {
                         const profile = Array.isArray(log.students?.profiles) ? log.students.profiles[0] : log.students?.profiles;
                         const fromClass = Array.isArray(log.from_classes) ? log.from_classes[0] : log.from_classes;
                         const toClass = Array.isArray(log.to_classes) ? log.to_classes[0] : log.to_classes;

                         return (
                           <tr key={log.id} style={{ borderBottom: "1px solid #F9FAFB" }}>
                             <td style={{ padding: "12px", fontSize: 12, color: COLORS.muted }}>
                               {new Date(log.promoted_at).toLocaleDateString()}
                             </td>
                             <td style={{ padding: "12px" }}>
                               <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.charcoal }}>{profile?.full_name}</div>
                               <div style={{ fontSize: 10, color: COLORS.muted }}>ADM: {profile?.code}</div>
                             </td>
                             <td style={{ padding: "12px" }}>
                               <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                                  <span style={{ color: COLORS.muted }}>{fromClass?.name || `Form ${log.from_level}`}</span>
                                  <span style={{ color: COLORS.forest }}>➜</span>
                                  <span style={{ fontWeight: 700, color: COLORS.forest }}>{toClass?.name || `Form ${log.to_level}`}</span>
                               </div>
                             </td>
                             <td style={{ padding: "12px", fontSize: 13, fontWeight: 700, color: COLORS.muted }}>
                               {log.academic_year}
                             </td>
                           </tr>
                         );
                       })
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
