"use client";

import React, { useState, useEffect, useMemo } from "react";
import { COLORS } from "@/lib/constants";
import { getStandardGrade } from "@/lib/grading";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { createClient } from "@/utils/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend 
} from 'recharts';

export const ResultsPage = ({ 
  role, 
  code, 
  schoolSettings: initialSettings,
  selectedYear
}: { 
  role: string; 
  code: string; 
  schoolSettings?: any;
  selectedYear: string;
}) => {
  const [activeTab, setActiveTab] = useState<"individual" | "bulk" | "report" | "insights" | "reportcard">("individual");
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);

  // Selection State
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTerm, setSelectedTerm] = useState(""); // Will derive from exam
  const [selectedExamId, setSelectedExamId] = useState("");
  const [activeExams, setActiveExams] = useState<any[]>([]);

  // Form State
  const [marksForm, setMarksForm] = useState<Record<string, string>>({}); // SubjectID -> Score
  const [bulkMarksForm, setBulkMarksForm] = useState<Record<string, string>>({}); // StudentID -> Score

  // Analytics State
  const [individualHistory, setIndividualHistory] = useState<any[]>([]);
  const [classHistory, setClassHistory] = useState<any[]>([]);
  const [distributionData, setDistributionData] = useState<any[]>([]);
  
  // Broadsheet State
  const [broadsheetData, setBroadsheetData] = useState<any[]>([]);
  const [streamView, setStreamView] = useState(false);

  // Insights State
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [subjectMeans, setSubjectMeans] = useState<any[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<any[]>([]);

  // Report Card State
  const [studentReport, setStudentReport] = useState<any>(null);
  const [schoolSettings, setSchoolSettings] = useState(initialSettings || {
    school_name: "KENYA SCHOOL SMS",
    school_address: "P.O. Box 1234 - 00100, Nairobi",
    school_phone: "+254 700 000 000",
    school_motto: "Excellence is our Tradition",
    school_email: "",
    school_logo_url: ""
  });
  
  const supabase = useMemo(() => createClient(), []);

  // Load initial data
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      
      // 1. Fetch Students
      const { data: stData } = await supabase.from('students').select('id, class_id, profiles(full_name, code)');
      if (stData) {
        const mappedSt = stData.map((s:any) => ({ id: s.id, name: s.profiles?.full_name, adm: s.profiles?.code, class_id: s.class_id }));
        setStudents(mappedSt);
        if (mappedSt.length > 0) setSelectedStudentId(mappedSt[0].id);
      }

      // 2. Fetch Subjects
      const { data: subData } = await supabase.from('subjects').select('id, name');
      if (subData) {
        setSubjects(subData);
        if (subData.length > 0) setSelectedSubjectId(subData[0].id);
      }

      // 3. Fetch Classes (with role-based filtering)
      let classQuery = supabase.from('classes').select('id, name, level').order('name');
      
      // If role is teacher, only get classes they are assigned to
      if (role === 'teacher' && code) {
        // First get profile id
        const { data: profile } = await supabase.from('profiles').select('id').eq('code', code).single();
        if (profile) {
          const { data: lessons } = await supabase.from('teacher_lessons').select('class_id').eq('teacher_id', profile.id);
          if (lessons && lessons.length > 0) {
            const classIds = lessons.map(l => l.class_id);
            classQuery = supabase.from('classes').select('id, name, level').in('id', classIds).order('name');
          } else {
            // No lessons assigned, might want to show empty or handle specially
            setClasses([]);
            setLoading(false);
            return;
          }
        }
      }

      const { data: classData, error: classError } = await classQuery;
      
      // Handle potential missing 'level' column fallback
      let finalClasses = classData;
      if (classError && classError.message.includes('level')) {
        const fallback = await supabase.from('classes').select('id, name').order('name');
        finalClasses = fallback.data as any;
      }

      if (finalClasses) {
        setClasses(finalClasses);
        // Auto-select first class if in a mode that needs it
        if (finalClasses.length > 0 && (activeTab === "bulk" || activeTab === "insights" || activeTab === "report")) {
          setSelectedClassId(finalClasses[0].id);
        }
      }

      // 4. Fetch School Settings if not provided
      if (!initialSettings) {
        const { data: settings } = await supabase.from('school_settings').select('*').eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle();
        if (settings) {
          setSchoolSettings(settings);
        }
      }

      // 5. Fetch Active & Closed Official Exams from Dean Workflow for the selected Year
      const { data: exData } = await supabase.from('exams')
        .select('*')
        .eq('academic_year', selectedYear)
        .in('status', ['active', 'closed'])
        .order('created_at', { ascending: false });
      if (exData) {
        setActiveExams(exData);
        if (exData.length > 0) {
           setSelectedExamId(exData[0].id);
           setSelectedTerm(exData[0].term);
        }
      }
      
      setLoading(false);
    };
    initData();
  }, [supabase, role, code, initialSettings, selectedYear]);

  // Sync internal settings if prop changes
  useEffect(() => {
    if (initialSettings) setSchoolSettings(initialSettings);
  }, [initialSettings]);

  // Handle default class selection on tab switch
  useEffect(() => {
    if (classes.length > 0) {
      if (activeTab === "individual" || activeTab === "reportcard") {
        // Keeps selectedClassId if it was already set, otherwise default to first class
        if (!selectedClassId) setSelectedClassId(""); 
      } else if (!selectedClassId || selectedClassId === "") {
        setSelectedClassId(classes[0].id); // Default to first class if none selected for bulk/analytics
      }
    }
  }, [activeTab, classes, selectedClassId]);

  // Sync Student Selection when class changes
  useEffect(() => {
    const filteredStudents = students.filter(s => !selectedClassId || s.class_id === selectedClassId);
    if (filteredStudents.length > 0) {
      const isCurrentStudentInFiltered = filteredStudents.some(s => s.id === selectedStudentId);
      if (!isCurrentStudentInFiltered) {
        setSelectedStudentId(filteredStudents[0].id);
      }
    } else {
      setSelectedStudentId("");
    }
  }, [selectedClassId, students, selectedStudentId]);

  // Load Single Student Data (Individual Tab)
  useEffect(() => {
    const fetchIndividual = async () => {
      if (!selectedStudentId || activeTab !== "individual") return;
      setLoading(true);
      
      // Fetch current results linked to specific official exam
      const { data: currentRes } = await supabase.from('results')
        .select(`score, subjects(id, name)`)
        .eq('student_id', selectedStudentId)
        .eq('exam_id', selectedExamId);
      
      if (currentRes) {
        setResults(currentRes);
        const updated: Record<string, string> = {};
        subjects.forEach(s => updated[s.id] = "");
        currentRes.forEach((r:any) => { if (r.subjects?.id) updated[r.subjects.id] = String(r.score); });
        setMarksForm(updated);
      }

      // Fetch history for trend
      const { data: historyRes } = await supabase.from('results').select('term, score').eq('student_id', selectedStudentId);
      if (historyRes) {
        const termGroups: Record<string, { term: string, total: number, count: number }> = {};
        historyRes.forEach((r: any) => {
          if (!termGroups[r.term]) termGroups[r.term] = { term: r.term, total: 0, count: 0 };
          termGroups[r.term].total += r.score;
          termGroups[r.term].count += 1;
        });
        setIndividualHistory(Object.values(termGroups).map(t => ({ term: t.term, average: Math.round(t.total / t.count) })).sort((a, b) => a.term.localeCompare(b.term)));
      }
      setLoading(false);
    };
    fetchIndividual();
  }, [selectedStudentId, selectedTerm, activeTab, subjects, supabase]);

  // Load Bulk Entry Data & Analytics (Bulk Tab)
  useEffect(() => {
    const fetchBulk = async () => {
      if (activeTab !== "bulk" || !selectedClassId || !selectedSubjectId) return;
      setLoading(true);
      
      const classSt = students.filter(s => s.class_id === selectedClassId);
      const stIds = classSt.map(s => s.id);
      if (stIds.length === 0) { setBulkMarksForm({}); setLoading(false); return; }

      // Get current marks
      const { data } = await supabase.from('results')
        .select('student_id, score')
        .in('student_id', stIds)
        .eq('subject_id', selectedSubjectId)
        .eq('exam_id', selectedExamId);

      const initialBulk: Record<string, string> = {};
      classSt.forEach(s => initialBulk[s.id] = "");
      
      // Calculate Distribution for current term/subject/class
      const dist = [
        { range: "0-39", count: 0, color: '#EF4444' },
        { range: "40-59", count: 0, color: '#F59E0B' },
        { range: "60-79", count: 0, color: '#3B82F6' },
        { range: "80-100", count: 0, color: '#10B981' }
      ];

      if (data) {
        data.forEach((r:any) => {
          initialBulk[r.student_id] = String(r.score);
          if (r.score < 40) dist[0].count++;
          else if (r.score < 60) dist[1].count++;
          else if (r.score < 80) dist[2].count++;
          else dist[3].count++;
        });
      }
      setBulkMarksForm(initialBulk);
      setDistributionData(dist);

      // Fetch Class Average History for this Subject
      const { data: hist } = await supabase.from('results')
        .select('term, score')
        .in('student_id', stIds)
        .eq('subject_id', selectedSubjectId);

      if (hist) {
        const groups: Record<string, { term: string, total: number, count: number }> = {};
        hist.forEach((r:any) => {
          if (!groups[r.term]) groups[r.term] = { term: r.term, total: 0, count: 0 };
          groups[r.term].total += r.score;
          groups[r.term].count++;
        });
        setClassHistory(Object.values(groups).map(g => ({ term: g.term, average: Math.round(g.total / g.count) })).sort((a,b) => a.term.localeCompare(b.term)));
      }

      setLoading(false);
    };
    fetchBulk();
  }, [activeTab, selectedClassId, selectedSubjectId, selectedExamId, students, supabase]);

  // Load Insights (Analytics Tab)
  useEffect(() => {
    const fetchInsights = async () => {
      if (activeTab !== "insights" || (!selectedClassId && !selectedLevel)) return;
      setLoading(true);

      let classSt;
      if (selectedClassId) {
        classSt = students.filter(s => s.class_id === selectedClassId);
      } else {
        const levelClasses = classes.filter(c => 
          String(c.level) === String(selectedLevel) || 
          String(c.name).startsWith(String(selectedLevel))
        ).map(c => c.id);
        classSt = students.filter(s => levelClasses.includes(s.class_id));
      }
      
      const stIds = classSt.map(s => s.id);
      if (stIds.length === 0) { setLoading(false); return; }

      const { data: resData } = await supabase.from('results')
        .select('student_id, subject_id, score, subjects(name)')
        .in('student_id', stIds)
        .eq('exam_id', selectedExamId);

      if (resData) {
        // 1. Top Performers (Total average)
        const stAggr: Record<string, { name: string, total: number, count: number }> = {};
        classSt.forEach(s => stAggr[s.id] = { name: s.name, total: 0, count: 0 });
        
        resData.forEach(r => {
          if (stAggr[r.student_id]) {
            stAggr[r.student_id].total += r.score;
            stAggr[r.student_id].count++;
          }
        });

        const ranked = Object.values(stAggr)
          .map(s => ({ name: s.name, average: s.count > 0 ? Math.round(s.total / s.count) : 0 }))
          .sort((a,b) => b.average - a.average)
          .slice(0, 5);
        setTopPerformers(ranked);

        // 2. Subject Means
        const subAggr: Record<string, { name: string, total: number, count: number }> = {};
        resData.forEach(r => {
          const subData = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
          const sName = subData?.name || "Unknown";
          if (!subAggr[sName]) subAggr[sName] = { name: sName, total: 0, count: 0 };
          subAggr[sName].total += r.score;
          subAggr[sName].count++;
        });
        setSubjectMeans(Object.values(subAggr).map(s => ({ name: s.name, mean: Math.round(s.total / s.count) })));

        // 3. Grade Distribution
        const dist = { A: 0, B: 0, C: 0, D: 0, E: 0 };
        resData.forEach(r => {
          if (r.score >= 80) dist.A++;
          else if (r.score >= 60) dist.B++;
          else if (r.score >= 50) dist.C++;
          else if (r.score >= 40) dist.D++;
          else dist.E++;
        });
        setGradeDistribution(Object.entries(dist).map(([grade, count]) => ({ name: grade, value: count })));
      }
      setLoading(false);
    };
    fetchInsights();
  }, [activeTab, selectedClassId, selectedLevel, selectedExamId, students, supabase]);

  // Load Individual Report Card
  useEffect(() => {
    const fetchReportCard = async () => {
      if (activeTab !== "reportcard" || !selectedStudentId) return;
      setLoading(true);

      const student = students.find(s => s.id === selectedStudentId);
      if (!student) { setLoading(false); return; }

      const { data: resData } = await supabase.from('results')
        .select('subject_id, score, exam_type, subjects(name)')
        .eq('student_id', selectedStudentId)
        .eq('exam_id', selectedExamId);

      if (resData) {
        // Group by subject to handle CATs + Exam weighted total
        const subMapped: Record<string, { name: string, scores: any[], final: number }> = {};
        resData.forEach(r => {
          const sid = r.subject_id;
          const subData = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
          if (!subMapped[sid]) subMapped[sid] = { name: subData?.name || "—", scores: [], final: 0 };
          subMapped[sid].scores.push({ type: r.exam_type, score: r.score });
        });

        // Simple weighting: if CAT and End Term exist, do 30/70. Else just use average.
        Object.values(subMapped).forEach(s => {
          const cat = s.scores.find(x => x.type.includes("CAT"))?.score;
          const exam = s.scores.find(x => x.type.includes("End"))?.score;
          if (cat !== undefined && exam !== undefined) {
            s.final = Math.round((cat * 0.3) + (exam * 0.7));
          } else {
            s.final = Math.round(s.scores.reduce((a,b) => a + b.score, 0) / s.scores.length);
          }
        });

        setStudentReport({
          student,
          subjects: Object.values(subMapped),
          overallAvg: Math.round(Object.values(subMapped).reduce((a,b) => a + b.final, 0) / Object.values(subMapped).length),
          term: selectedTerm
        });
      }
      setLoading(false);
    };
    fetchReportCard();
  }, [activeTab, selectedStudentId, selectedExamId, students, supabase]);

  // Load Broadsheet (Report Tab)
  useEffect(() => {
    const fetchReport = async () => {
      if (activeTab !== "report" || (!selectedClassId && !selectedLevel)) return;
      setLoading(true);
      
      const currentClass = classes.find(c => c.id === selectedClassId);
      if (!currentClass) { setLoading(false); return; }

      let targetSt;
      if (streamView) {
        const levelToUse = selectedLevel || classes.find(c => c.id === selectedClassId)?.level;
        if (!levelToUse) { setBroadsheetData([]); setLoading(false); return; }
        
        const levelClasses = classes.filter(c => 
          String(c.level) === String(levelToUse) || 
          String(c.name).startsWith(String(levelToUse))
        ).map(c => c.id);
        targetSt = students.filter(s => levelClasses.includes(s.class_id));
      } else {
        const classId = selectedClassId || classes.find(c => 
          String(c.level) === String(selectedLevel) || 
          String(c.name).startsWith(String(selectedLevel))
        )?.id;
        if (!classId) { setBroadsheetData([]); setLoading(false); return; }
        targetSt = students.filter(s => s.class_id === classId);
      }

      const stIds = targetSt.map(s => s.id);
      if (stIds.length === 0) { setBroadsheetData([]); setLoading(false); return; }

      const { data } = await supabase.from('results')
        .select('student_id, subject_id, score, exam_type')
        .in('student_id', stIds)
        .eq('exam_id', selectedExamId);

      const sheet = targetSt.map(s => {
        const classObj = classes.find(c => c.id === s.class_id);
        const stRes = data?.filter(r => r.student_id === s.id) || [];
        
        // Group by subject for compilation
        const subAggr: Record<string, { scores: any[], final: number }> = {};
        stRes.forEach(r => {
          if (!subAggr[r.subject_id]) subAggr[r.subject_id] = { scores: [], final: 0 };
          subAggr[r.subject_id].scores.push({ type: r.exam_type, score: r.score });
        });

        // Compute Compiled Score (30/70 weighting if possible)
        const subScores: Record<string, number> = {};
        Object.entries(subAggr).forEach(([sid, data]) => {
          const cat = data.scores.find(x => x.type?.includes("CAT"))?.score;
          const exam = data.scores.find(x => x.type?.includes("End"))?.score;
          if (cat !== undefined && exam !== undefined) {
             subScores[sid] = Math.round((cat * 0.3) + (exam * 0.7));
          } else {
             subScores[sid] = Math.round(data.scores.reduce((a,b) => a + b.score, 0) / data.scores.length);
          }
        });
        
        const subjectsIncluded = Object.values(subScores);
        const total = subjectsIncluded.reduce((acc, curr) => acc + curr, 0);
        const avg = subjectsIncluded.length > 0 ? (total / subjectsIncluded.length).toFixed(1) : 0;
        
        return { ...s, scores: subScores, total, avg, className: classObj?.name || "N/A" };
      }).sort((a, b) => Number(b.avg) - Number(a.avg));

      setBroadsheetData(sheet);
      setLoading(false);
    };
    fetchReport();
  }, [activeTab, selectedClassId, selectedLevel, selectedExamId, students, supabase, streamView, classes]);

  const handleSaveMarks = async () => {
    const selectedExam = activeExams.find(e => e.id === selectedExamId);
    if (!selectedExam) return alert("Select an official exam.");
    if (selectedExam.status === 'closed') return alert("This exam has been locked by the Dean.");

    const upserts = Object.entries(marksForm)
      .filter(([subId, score]) => score !== "" && Number(score) >= 0)
      .map(([subId, score]) => ({ student_id: selectedStudentId, subject_id: subId, term: selectedExam.term, exam_type: selectedExam.title, exam_id: selectedExam.id, score: Number(score) }));
    if (upserts.length === 0) return alert("Enter scores first.");
    const { error } = await supabase.from('results').upsert(upserts, { onConflict: "student_id, subject_id, term, exam_type" });
    if (error) alert("Error: " + error.message);
    else alert("Saved!");
  };

  const handleBulkSave = async () => {
    const selectedExam = activeExams.find(e => e.id === selectedExamId);
    if (!selectedExam) return alert("Select an official exam.");
    if (selectedExam.status === 'closed') return alert("This exam has been locked by the Dean.");

    const upserts = Object.entries(bulkMarksForm)
      .filter(([stId, score]) => score !== "" && Number(score) >= 0)
      .map(([stId, score]) => ({ student_id: stId, subject_id: selectedSubjectId, term: selectedExam.term, exam_type: selectedExam.title, exam_id: selectedExam.id, score: Number(score) }));
    if (upserts.length === 0) return alert("No scores.");
    const { error } = await supabase.from('results').upsert(upserts, { onConflict: "student_id, subject_id, term, exam_type" });
    if (error) alert("Error: " + error.message);
    else alert("Class marks saved!");
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const selectedStudentObj = students.find(s => s.id === selectedStudentId) || { name: "N/A", adm: "N/A" };
  const avgLineColor = COLORS.forest;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-report, #printable-report * { visibility: visible; }
          #printable-report { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            margin: 0;
            padding: 0;
          }
          .no-print { display: none !important; }
          @page { 
            size: auto; 
            margin: 15mm; 
          }
          table { page-break-inside: auto; width: 100% !important; border-collapse: collapse !important; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>

      {/* Mode Switcher */}
      <div className="no-print" style={{ display: "flex", background: COLORS.paper, padding: 4, borderRadius: 12, width: "fit-content", alignSelf: "center", border: `1px solid ${COLORS.forest}20` }}>
        {[
          { id: "individual", label: "Individual Entry" },
          { id: "bulk", label: "Bulk Entry" },
          { id: "report", label: "Broadsheet" },
          { id: "insights", label: "Analytics Insights" },
          { id: "reportcard", label: "Individual Report Card" }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{ 
              padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", 
              background: activeTab === tab.id ? COLORS.forest : "transparent", color: activeTab === tab.id ? "#fff" : COLORS.muted 
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Shared Filters */}
      <div className="no-print" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Select Form</label>
          <select value={selectedLevel} onChange={e => {
            const val = e.target.value;
            setSelectedLevel(val);
            setSelectedClassId(""); 
            if (activeTab === "report" && val !== "") setStreamView(true);
          }} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid #E5E7EB`, fontSize: 13 }}>
            <option value="">-- All Forms --</option>
            <option value="1">Form 1</option>
            <option value="2">Form 2</option>
            <option value="3">Form 3</option>
            <option value="4">Form 4</option>
          </select>
        </div>
        {(activeTab === "individual" || activeTab === "reportcard") ? (
          <>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Filter by Class</label>
              <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid #E5E7EB`, fontSize: 13 }}>
                <option value="">-- All Classes --</option>
                {classes
                  .filter(c => 
                    !selectedLevel || 
                    String(c.level) === String(selectedLevel) || 
                    String(c.name).startsWith(String(selectedLevel))
                  )
                  .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Select Student</label>
              <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid #E5E7EB`, fontSize: 13 }}>
                {students
                  .filter(s => !selectedClassId || s.class_id === selectedClassId)
                  .map((s) => <option key={s.id} value={s.id}>{s.name} ({s.adm})</option>)}
              </select>
            </div>
          </>
        ) : (
          <>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Select Class</label>
              <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid #E5E7EB`, fontSize: 13 }}>
                <option value="">-- Select Class --</option>
                {classes
                  .filter(c => 
                    !selectedLevel || 
                    String(c.level) === String(selectedLevel) || 
                    String(c.name).startsWith(String(selectedLevel))
                  )
                  .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {activeTab === "bulk" && (
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Select Subject</label>
                <select value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid #E5E7EB`, fontSize: 13 }}>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </>
        )}
        
        <div>
          <label style={{ fontSize: 10, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Official Exam</label>
          <select value={selectedExamId} onChange={e => {
             setSelectedExamId(e.target.value);
             const ex = activeExams.find(x => x.id === e.target.value);
             if (ex) setSelectedTerm(ex.term);
          }} style={{ padding: "10px", borderRadius: 10, border: `1px solid #E5E7EB`, fontSize: 13, minWidth: 200 }}>
            {activeExams.length === 0 ? <option value="">-- No Active Exams --</option> : null}
            {activeExams.map(e => <option key={e.id} value={e.id}>{e.title} ({e.academic_year}) {e.status === 'closed' ? '🔒' : ''}</option>)}
          </select>
        </div>
      </div>

      {activeTab === "individual" && (
        <>
          <div className="no-print" style={{ background: `linear-gradient(135deg, ${COLORS.forest}, ${COLORS.forestMid})`, borderRadius: 16, padding: 24, color: "#fff", display: "flex", gap: 24, alignItems: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800 }}>{selectedStudentObj.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{selectedStudentObj.name}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{selectedStudentObj.adm}</div>
            </div>
          </div>

          <div className="no-print" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: "#fff", padding: 20, borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, marginBottom: 16 }}>Current Scores</div>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.map(r => ({ name: r.subjects?.name, score: r.score }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: '#F9FAFB'}} contentStyle={{ borderRadius: 10, border: 'none' }} />
                    <Bar dataKey="score" fill={COLORS.forest} radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ background: "#fff", padding: 20, borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, marginBottom: 16 }}>Trend Analysis</div>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={individualHistory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="term" fontSize={11} axisLine={false} />
                    <YAxis domain={[0, 100]} fontSize={11} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none' }} />
                    <Line type="monotone" dataKey="average" stroke={COLORS.gold} strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="no-print" style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
            <SectionHeader title="✏️ Individual Mark Entry" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
              {subjects.map((sub) => (
                <div key={sub.id} style={{ background: COLORS.paper, padding: 12, borderRadius: 12, border: `1px solid ${COLORS.forest}10` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.forest, marginBottom: 8, textTransform: "uppercase" }}>{sub.name}</div>
                  <input type="number" value={marksForm[sub.id] || ""} onChange={e => setMarksForm({...marksForm, [sub.id]: e.target.value})} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", textAlign: "center", fontWeight: 700, fontSize: 14 }} />
                </div>
              ))}
            </div>
            <button onClick={handleSaveMarks} style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10, padding: "12px 30px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Save Results</button>
          </div>
        </>
      )}

      {activeTab === "bulk" && (
        <>
          <div className="no-print" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: "#fff", padding: 20, borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, marginBottom: 16, textTransform: "uppercase" }}>Class Score Distribution</div>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="range" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                      {distributionData.map((entry, index) => <Bar key={`cell-${index}`} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ background: "#fff", padding: 20, borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, marginBottom: 16, textTransform: "uppercase" }}>Class Average Trend</div>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={classHistory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="term" fontSize={11} />
                    <YAxis domain={[0, 100]} fontSize={11} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none' }} />
                    <Line type="monotone" dataKey="average" stroke={COLORS.forest} strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="no-print" style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <SectionHeader title={`✏️ Bulk Entry: ${subjects.find(s=>s.id === selectedSubjectId)?.name}`} />
              <button onClick={handleBulkSave} style={{ background: COLORS.gold, color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 700, cursor: "pointer" }}>Save All Marks</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.paper }}>
                  <th style={{ textAlign: "left", padding: "12px", fontSize: 12, color: COLORS.muted }}>Student</th>
                  <th style={{ textAlign: "center", padding: "12px", fontSize: 12, color: COLORS.muted, width: 150 }}>Score (0-100)</th>
                  <th style={{ textAlign: "center", padding: "12px", fontSize: 12, color: COLORS.muted, width: 200 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.filter(s => s.class_id === selectedClassId).map(s => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>{s.adm}</div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input type="number" value={bulkMarksForm[s.id] || ""} onChange={e => setBulkMarksForm({...bulkMarksForm, [s.id]: e.target.value})} style={{ width: 80, padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", textAlign: "center", fontWeight: 700, fontSize: 15 }} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {bulkMarksForm[s.id] !== "" && <Badge type={Number(bulkMarksForm[s.id]) >= 40 ? 'info' : 'danger'}>{Number(bulkMarksForm[s.id]) >= 40 ? 'Pass' : 'Low'}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "report" && (
        <div id="printable-report" style={{ background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              {/* Logo */}
              {schoolSettings.school_logo_url ? (
                <img src={schoolSettings.school_logo_url} alt="Logo" style={{ width: 80, height: 80, objectFit: "contain" }} />
              ) : (
                <div style={{ width: 80, height: 80, border: "2px solid #000", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, textAlign: "center" }}>
                  SCHOOL<br/>LOGO
                </div>
              )}
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.forest, letterSpacing: "-0.02em", textTransform: "uppercase" }}>{schoolSettings.school_name}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.charcoal }}>
                  Official {streamView ? `Form ${selectedLevel || classes.find(c=>c.id === selectedClassId)?.level} Compiled` : "Class"} Result Sheet
                </div>
                <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 4 }}>
                  {streamView ? (
                    <>Stream: <strong>All Form {selectedLevel || classes.find(c=>c.id === selectedClassId)?.level} Classes</strong></>
                  ) : (
                    <>Class: <strong>{classes.find(c=>c.id === selectedClassId)?.name}</strong></>
                  )}
                  {" "}| Term: <strong>{selectedTerm}</strong>
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>{schoolSettings.school_address} | Tel: {schoolSettings.school_phone}</div>
              </div>
            </div>
              <div className="no-print" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <button 
                  onClick={() => setStreamView(false)} 
                  style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: streamView ? "none" : `1px solid ${COLORS.forest}`, background: streamView ? COLORS.paper : "#fff", color: streamView ? COLORS.muted : COLORS.forest, cursor: "pointer" }}
                >
                  This Class
                </button>
                <button 
                  onClick={() => setStreamView(true)} 
                  style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: !streamView ? "none" : `1px solid ${COLORS.forest}`, background: !streamView ? COLORS.paper : "#fff", color: !streamView ? COLORS.muted : COLORS.forest, cursor: "pointer" }}
                >
                  Entire Stream
                </button>
              </div>
            <button className="no-print" onClick={handleDownloadPDF} style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="download" size={16} color="#fff" /> Download PDF Report
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid #E5E7EB` }}>
              <thead>
                <tr style={{ background: COLORS.paper }}>
                  <th style={{ padding: "12px 10px", textAlign: "left", fontSize: 11, border: `1px solid #E5E7EB` }}>ADM</th>
                  <th style={{ padding: "12px 10px", textAlign: "left", fontSize: 11, border: `1px solid #E5E7EB`, minWidth: 150 }}>STUDENT NAME</th>
                  {streamView && <th style={{ padding: "12px 10px", textAlign: "left", fontSize: 11, border: `1px solid #E5E7EB` }}>CLASS</th>}
                  {subjects.map(s => (
                    <th key={s.id} style={{ padding: "12px 6px", textAlign: "center", fontSize: 10, border: `1px solid #E5E7EB`, textTransform: "uppercase", width: 60 }}>{s.name.substring(0, 4)}</th>
                  ))}
                  <th style={{ padding: "12px 10px", textAlign: "center", fontSize: 11, fontWeight: 800, border: `1px solid #E5E7EB`, background: COLORS.cream }}>TOTAL</th>
                  <th style={{ padding: "12px 10px", textAlign: "center", fontSize: 11, fontWeight: 800, border: `1px solid #E5E7EB`, background: COLORS.cream }}>AVG</th>
                  <th style={{ padding: "12px 10px", textAlign: "center", fontSize: 11, fontWeight: 800, border: `1px solid #E5E7EB`, background: COLORS.cream }}>RANK</th>
                </tr>
              </thead>
              <tbody>
                {broadsheetData.length === 0 ? (
                   <tr><td colSpan={subjects.length + 5} style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>No results available to compile.</td></tr>
                ) : broadsheetData.map((s, idx) => (
                  <tr key={s.id} style={{ borderBottom: `1px solid #F3F4F6` }}>
                    <td style={{ padding: "10px", fontSize: 12, border: `1px solid #E5E7EB`, fontFamily: "'IBM Plex Mono'" }}>{s.adm}</td>
                    <td style={{ padding: "10px", fontSize: 12, fontWeight: 700, border: `1px solid #E5E7EB` }}>{s.name}</td>
                    {streamView && <td style={{ padding: "10px", fontSize: 12, border: `1px solid #E5E7EB` }}>{s.className}</td>}
                    {subjects.map(sub => (
                      <td key={sub.id} style={{ padding: "10px", textAlign: "center", fontSize: 13, border: `1px solid #E5E7EB`, background: (s.scores[sub.id] || 0) < 40 ? '#FFF1F2' : 'transparent' }}>
                        {s.scores[sub.id] || "-"}
                      </td>
                    ))}
                    <td style={{ padding: "10px", textAlign: "center", fontSize: 13, fontWeight: 800, background: COLORS.paper, border: `1px solid #E5E7EB` }}>{s.total}</td>
                    <td style={{ padding: "10px", textAlign: "center", fontSize: 13, fontWeight: 800, background: COLORS.paper, border: `1px solid #E5E7EB` }}>{s.avg}%</td>
                    <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, border: `1px solid #E5E7EB` }}>{idx + 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "insights" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: "#fff", padding: 24, borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
              <SectionHeader title="🏆 Top Performers" />
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                {topPerformers.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: i === 0 ? COLORS.cream : "#fff", borderRadius: 12, border: `1px solid ${i === 0 ? COLORS.gold : "#F3F4F6"}` }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: i === 0 ? COLORS.gold : COLORS.forest, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{i + 1}</div>
                    <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontWeight: 800, color: COLORS.forest }}>{s.average}%</div>
                  </div>
                ))}
                {topPerformers.length === 0 && <div style={{ textAlign: "center", color: COLORS.muted, padding: 20 }}>No data available for this class.</div>}
              </div>
            </div>
            <div style={{ background: "#fff", padding: 24, borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
              <SectionHeader title="📊 Mean Score per Subject" />
              <div style={{ height: 250, marginTop: 16 }}>
                {subjectMeans.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectMeans}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis domain={[0, 100]} fontSize={11} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: "none" }} />
                      <Bar dataKey="mean" fill={COLORS.forestMid} radius={[4, 4, 0, 0]} barSize={35} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ textAlign: "center", color: COLORS.muted, padding: 80 }}>No analysis available.</div>}
              </div>
            </div>
          </div>
          <div style={{ background: "#fff", padding: 24, borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
             <SectionHeader title="📈 Overall Grade Distribution" />
             <div style={{ height: 300, marginTop: 16 }}>
                {gradeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gradeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={12} fontWeight={700} />
                      <YAxis fontSize={11} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: "none" }} />
                      <Bar dataKey="value" fill={COLORS.gold} radius={[4, 4, 0, 0]} barSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ textAlign: "center", color: COLORS.muted, padding: 100 }}>Enter some results to see distribution.</div>}
             </div>
          </div>
        </div>
      )}

      {activeTab === "reportcard" && studentReport && (
        <div id="printable-report" style={{ background: "#fff", borderRadius: 16, padding: "40px", boxShadow: "0 1px 3px rgba(0,0,0,.08)", position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: 30, borderBottom: `2px solid ${COLORS.forest}`, paddingBottom: 20 }}>
            <div style={{ width: 80, height: 80, border: `2px solid ${COLORS.forest}`, borderRadius: "50%", margin: "0 auto 15px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, textAlign: "center", color: COLORS.forest }}>
              SCHOOL<br/>LOGO
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: COLORS.forest, letterSpacing: "-0.02em", marginBottom: 4, textTransform: "uppercase" }}>{schoolSettings.school_name}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.charcoal }}>{schoolSettings.school_address}</div>
            <div style={{ fontSize: 13, color: COLORS.muted, margin: "4px 0" }}>Tel: {schoolSettings.school_phone} | Email: {schoolSettings.school_email || "info@school.ac.ke"}</div>
            <div style={{ fontSize: 13, color: COLORS.forest, fontStyle: "italic", fontWeight: 700, marginTop: 8 }}>"{schoolSettings.school_motto}"</div>
            <div style={{ margin: "20px auto 10px", height: 1, background: "#E5E7EB", width: "50%" }}></div>
            <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.charcoal }}>{studentReport.student.name}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted }}>ADM: {studentReport.student.adm} | {studentReport.term} Official Report Card</div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20, border: "1px solid #E5E7EB" }}>
            <thead>
              <tr style={{ background: COLORS.paper }}>
                <th style={{ padding: "12px", textAlign: "left", border: "1px solid #E5E7EB", fontSize: 13 }}>SUBJECT</th>
                <th style={{ padding: "12px", textAlign: "center", border: "1px solid #E5E7EB", fontSize: 13 }}>WEIGHTED SCORE</th>
                <th style={{ padding: "12px", textAlign: "center", border: "1px solid #E5E7EB", fontSize: 13 }}>GRADE</th>
                <th style={{ padding: "12px", textAlign: "left", border: "1px solid #E5E7EB", fontSize: 13 }}>TEACHER REMARK</th>
              </tr>
            </thead>
            <tbody>
              {studentReport.subjects.map((s:any, i:number) => {
                const remark = s.final >= 80 ? "Excellence. Exemplary performance." : 
                               s.final >= 60 ? "Good work. Maintain the effort." :
                               s.final >= 40 ? "Average. Improvement is needed." : "Weak. Targeted revision required.";
                const gradeInfo = s.final >= 80 ? { g: "A", c: "#16a34a" } :
                                 s.final >= 70 ? { g: "B", c: "#2563eb" } :
                                 s.final >= 50 ? { g: "C", c: "#d97706" } :
                                 s.final >= 40 ? { g: "D", c: "#ea580c" } : { g: "E", c: "#dc2626" };
                return (
                  <tr key={i}>
                    <td style={{ padding: "12px", fontWeight: 700, border: "1px solid #E5E7EB", fontSize: 14 }}>{s.name}</td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: 800, border: "1px solid #E5E7EB", fontSize: 15 }}>{s.final}%</td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: 900, color: gradeInfo.c, border: "1px solid #E5E7EB", fontSize: 17 }}>{gradeInfo.g}</td>
                    <td style={{ padding: "12px", fontSize: 13, fontStyle: "italic", border: "1px solid #E5E7EB" }}>{remark}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 30, padding: 24, background: COLORS.cream, borderRadius: 16, border: `2px solid ${COLORS.gold}40`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: COLORS.charcoal }}>OVERALL PERFORMANCE</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.forest }}>MEAN: {studentReport.overallAvg}%</div>
            </div>
          </div>

          <div style={{ marginTop: 40, borderTop: "2px solid #F3F4F6", paddingTop: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Principal's Remarks</div>
            <div style={{ minHeight: 80, borderBottom: "1px solid #EEE", fontSize: 15, lineHeight: "1.6" }}>
              {studentReport.overallAvg >= 70 ? "Exceptional academic standards. The student is focused and disciplined." :
               studentReport.overallAvg >= 50 ? "Satisfactory performance. There is potential for higher ranking with more practice." :
               "The student needs extra academic support and close monitoring in most subjects."}
            </div>
          </div>

          <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 100 }}>
             <div style={{ borderTop: "1px solid #333", textAlign: "center", paddingTop: 10, fontSize: 12, fontWeight: 700 }}>Class Teacher's Signature</div>
             <div style={{ borderTop: "1px solid #333", textAlign: "center", paddingTop: 10, fontSize: 12, fontWeight: 700 }}>Principal's Stamp & Signature</div>
          </div>
          
          <div className="no-print" style={{ position: "absolute", top: 40, right: 40, display: "flex", gap: 8 }}>
            <button onClick={handleDownloadPDF} style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="download" size={16} color="#fff" /> Download Report Card
            </button>
            <button onClick={() => setActiveTab("individual")} style={{ background: COLORS.paper, color: COLORS.charcoal, border: `1px solid ${COLORS.muted}40`, borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="close" size={16} /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
