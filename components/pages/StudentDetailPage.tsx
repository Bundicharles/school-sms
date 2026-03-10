"use client";

import React, { useState, useEffect, useMemo } from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { createClient } from "@/utils/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell
} from 'recharts';

export const StudentDetailPage = ({ 
  studentId, 
  onBack, 
  schoolSettings: initialSettings,
  selectedYear
}: { 
  studentId: string; 
  onBack: () => void; 
  schoolSettings?: any;
  selectedYear: string;
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState<any>(null);
  const [file, setFile] = useState<any>({
    parent_contact: "",
    emergency_contact: "",
    hobbies: "",
    cocurricular: "",
    character_comments: "",
    leadership_roles: "",
    admission_date: "",
    leaving_date: "",
    overall_grade: "",
    certificate_no: ""
  });
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [schoolSettings, setSchoolSettings] = useState(initialSettings || {
    school_name: "KENYA HIGH SCHOOL",
    school_address: "P.O. Box 1234 - 00100, Nairobi",
    school_phone: "+254 700 000 000",
    school_email: "info@kenyahigh.ac.ke",
    school_motto: "Where Excellence is a Tradition",
    school_logo_url: ""
  });

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const fetchFullProfile = async () => {
      setLoading(true);
      
      // 1. Get basic info
      const { data: stData } = await supabase
        .from('students')
        .select('id, class_id, classes(name), profiles(full_name, code)')
        .eq('id', studentId)
        .single();
      
      if (stData) {
        const s = stData as any;
        setStudent({
          id: s.id,
          name: s.profiles?.full_name,
          adm: s.profiles?.code,
          className: s.classes?.name
        });
      }

      // 2. Get additional file details
      const { data: fileData } = await supabase
        .from('student_files')
        .select('*')
        .eq('student_id', studentId)
        .single();
      
      if (fileData) {
        setFile(fileData);
      }

      // 3. Get Academic Performance Data (Aggregated by Term)
      const { data: results } = await supabase
        .from('results')
        .select('term, score')
        .eq('student_id', studentId);
      
      if (results) {
        const termAggr: Record<string, { term: string, total: number, count: number }> = {};
        results.forEach(r => {
          if (!termAggr[r.term]) termAggr[r.term] = { term: r.term, total: 0, count: 0 };
          termAggr[r.term].total += r.score;
          termAggr[r.term].count += 1;
        });

        const chartData = Object.values(termAggr)
          .map(t => ({ 
            name: t.term, 
            average: Math.round(t.total / t.count) 
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setPerformanceData(chartData);
      }

      // 4. Get School Branding Settings if not provided
      if (!initialSettings) {
        const { data: settings } = await supabase.from('school_settings').select('*').eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle();
        if (settings) {
          setSchoolSettings(settings);
        }
      }
      
      setLoading(false);
    };

    fetchFullProfile();
  }, [studentId, supabase, initialSettings]);

  // Sync internal settings if prop changes
  useEffect(() => {
    if (initialSettings) setSchoolSettings(initialSettings);
  }, [initialSettings]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('student_files')
      .upsert({
        student_id: studentId,
        ...file,
        last_updated_at: new Date().toISOString()
      }, { onConflict: 'student_id' });

    if (error) {
      alert("Error saving: " + error.message);
    } else {
      alert("Profile updated successfully!");
    }
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: COLORS.forest, fontWeight: 700 }}>Loading Student Profile...</div>;
  if (!student) return <div style={{ padding: 40, textAlign: "center" }}>Student not found. <button onClick={onBack}>Go Back</button></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 0;
          }
          body * { visibility: hidden; background: none !important; }
          #printable-certificate, #printable-certificate * { visibility: visible; }
          #printable-certificate { 
            position: fixed; 
            left: 0; 
            top: 0; 
            width: 100%; 
            height: 100vh;
            padding: 50px;
            margin: 0;
            display: flex !important;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            background: white !important;
            overflow: hidden !important;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .no-print { display: none !important; }
        }
        #printable-certificate { display: none; }
      `}</style>
      
      {/* Profile Content */}
      <button 
        className="no-print"
        onClick={onBack}
        style={{ background: "none", border: "none", color: COLORS.forest, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "fit-content" }}
      >
        <Icon name="back" size={16} color={COLORS.forest} /> Back to Dashboard
      </button>

      {/* Profile Header */}
      <div style={{ background: `linear-gradient(135deg, ${COLORS.forest}, ${COLORS.forestMid})`, borderRadius: 16, padding: 32, color: "#fff", display: "flex", gap: 24, alignItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 800 }}>
          {student.name[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{student.name}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, opacity: 0.9 }}>
            <span>ADM: <strong>{student.adm}</strong></span>
            <span>Class: <strong>{student.className}</strong></span>
          </div>
        </div>
        <Badge type="info">Student Profile</Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24 }}>
        {/* Academic Summary Chart */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <SectionHeader title="📊 Academic performance trend" />
          <div style={{ height: 260, minHeight: 260, marginTop: 20 }}>
            {performanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: COLORS.paper }} 
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                  />
                  <Bar dataKey="average" radius={[6, 6, 0, 0]} barSize={40}>
                    {performanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.average >= 70 ? COLORS.forest : entry.average >= 50 ? COLORS.gold : COLORS.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted, fontSize: 13, border: "1px dashed #E5E7EB", borderRadius: 12 }}>
                No academic results found for this student.
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Contact Details */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", flex: 1 }}>
            <SectionHeader title="📞 Household contact" />
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
               <div>
                 <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Parent/Guardian Contact</label>
                 <input 
                   value={file.parent_contact || ""} 
                   onChange={e => setFile({...file, parent_contact: e.target.value})}
                   placeholder="Name & Phone Number"
                   style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14 }}
                 />
               </div>
               <div>
                 <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Emergency Contact</label>
                 <input 
                   value={file.emergency_contact || ""} 
                   onChange={e => setFile({...file, emergency_contact: e.target.value})}
                   placeholder="Name & Phone Number"
                   style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14 }}
                 />
               </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
        {/* Cocurricular Activities */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <SectionHeader title="🏆 Cocurricular & Leadership" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 16 }}>
             <div>
               <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Games & Clubs</label>
               <input 
                 value={file.cocurricular || ""} 
                 onChange={e => setFile({...file, cocurricular: e.target.value})}
                 placeholder="e.g. Football team captain, Drama club"
                 style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14 }}
               />
             </div>
             <div>
               <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Leadership Roles</label>
               <input 
                 value={file.leadership_roles || ""} 
                 onChange={e => setFile({...file, leadership_roles: e.target.value})}
                 placeholder="e.g. Class Prefect, Head Student"
                 style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14 }}
               />
             </div>
          </div>
        </div>
      </div>

      {/* Living Certificate Prep */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <SectionHeader title="📜 Graduation & Character Details" />
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 20, marginTop: 24, background: COLORS.paper, padding: 20, borderRadius: 12 }}>
           <div>
             <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Admission Date</label>
             <input type="date" value={file.admission_date || ""} onChange={e => setFile({...file, admission_date: e.target.value})} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5E7EB" }} />
           </div>
           <div>
             <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Leaving Date</label>
             <input type="date" value={file.leaving_date || ""} onChange={e => setFile({...file, leaving_date: e.target.value})} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5E7EB" }} />
           </div>
           <div>
             <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Overall Grade</label>
             <input value={file.overall_grade || ""} onChange={e => setFile({...file, overall_grade: e.target.value})} placeholder="e.g. A- Overall" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5E7EB" }} />
           </div>
           <div>
             <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Certificate No.</label>
             <input value={file.certificate_no || ""} onChange={e => setFile({...file, certificate_no: e.target.value})} placeholder="Unique SLC ID" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5E7EB" }} />
           </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
           <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>General Hobbies</label>
              <textarea 
                value={file.hobbies || ""} 
                onChange={e => setFile({...file, hobbies: e.target.value})}
                style={{ width: "100%", height: 100, padding: 12, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, resize: "none" }}
              />
           </div>
           <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Character & Conduct Comments</label>
              <textarea 
                value={file.character_comments || ""} 
                onChange={e => setFile({...file, character_comments: e.target.value})}
                placeholder="Observed character traits for formal certificate..."
                style={{ width: "100%", height: 100, padding: 12, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, resize: "none" }}
              />
           </div>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingTop: 24, borderTop: "1px solid #F3F4F6" }}>
          <div>
             <div style={{ fontWeight: 700, fontSize: 14 }}>Living Certificate Ready?</div>
             <div style={{ fontSize: 12, color: COLORS.muted }}>Once information is saved, it will be used for official document generation.</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button 
              onClick={handleSave} 
              disabled={saving}
              style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10, padding: "12px 30px", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving..." : "Save Profile Details"}
            </button>
            <button 
              style={{ background: COLORS.cream, color: COLORS.forest, border: `1px solid ${COLORS.forest}20`, borderRadius: 10, padding: "12px 30px", fontWeight: 700, cursor: "pointer" }}
              onClick={() => window.print()}
            >
              Generate Certificate
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Certificate for Printing */}
      <div id="printable-certificate" style={{ 
        fontFamily: "'Times New Roman', serif", 
        color: "#000",
        background: "#fff",
        height: "100vh",
        display: "none", // Force hidden on screen in React
        flexDirection: "column",
        border: "12px double #1a1a1a",
        padding: "45px",
        position: "relative",
        boxSizing: "border-box",
        overflow: "hidden"
      }}>
        {/* Certificate Border Accent */}
        <div style={{ position: "absolute", top: 10, left: 10, right: 10, bottom: 10, border: "2px solid #ddd", pointerEvents: "none" }}></div>
        
        <div style={{ textAlign: "center", position: "relative", zIndex: 10 }}>
           {/* Logo */}
           {schoolSettings.school_logo_url ? (
             <img src={schoolSettings.school_logo_url} alt="Logo" style={{ width: 100, height: 100, objectFit: "contain", marginBottom: 15 }} />
           ) : (
             <div style={{ width: 100, height: 100, border: "2px solid #000", borderRadius: "50%", margin: "0 auto 15px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, textAlign: "center" }}>
               SCHOOL<br/>LOGO
             </div>
           )}
           
           <div style={{ fontSize: 32, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, color: "#000" }}>{schoolSettings.school_name}</div>
           <div style={{ fontSize: 15, marginTop: 4, fontWeight: 600 }}>{schoolSettings.school_address}</div>
           <div style={{ fontSize: 13, marginTop: 2 }}>Tel: {schoolSettings.school_phone} | Email: {schoolSettings.school_email || "info@school.ac.ke"}</div>
           <div style={{ fontSize: 13, marginTop: 4, fontStyle: "italic", fontWeight: 700 }}>"{schoolSettings.school_motto || "Excellence is our Tradition"}"</div>
           
           <div style={{ margin: "20px auto", width: "80%", height: "2px", background: "#000" }}></div>
           
           <div style={{ fontSize: 40, fontFamily: "'EB Garamond', serif", fontWeight: 800, textTransform: "uppercase", letterSpacing: 3, marginTop: 10 }}>School Leaving Certificate</div>
        </div>

        <div style={{ flex: 1, marginTop: 30, fontSize: 19, lineHeight: 1.8, textAlign: "center", padding: "0 30px" }}>
          <p style={{ margin: 0 }}>This is to certify that</p>
          <div style={{ fontSize: 26, fontWeight: 800, textTransform: "uppercase", margin: "10px 0", borderBottom: "1px dashed #000", display: "inline-block", padding: "0 20px" }}>
            {student.name}
          </div>
          
          <p style={{ margin: 0 }}>
            Admission Number: <strong>{student.adm}</strong> has been a student in this institution
          </p>
          
          <p style={{ margin: 0 }}>
            from <strong>{file.admission_date ? new Date(file.admission_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : "[Admission Date]"}</strong> to <strong>{file.leaving_date ? new Date(file.leaving_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : "[Leaving Date]"}</strong>
          </p>

          <p style={{ marginTop: 15 }}>
            He/She has satisfactorily completed the <strong>Kenya Certificate of Secondary Education</strong> requirements 
            and was in <strong>{student.className}</strong>.
          </p>

          <p style={{ marginTop: 15 }}>
            Overall Performance: <strong style={{ fontSize: 24 }}>{file.overall_grade || "Grade A- Overall"}</strong>
          </p>

          <p style={{ marginTop: 15, fontStyle: "italic" }}>
            "The student was of good character and conduct throughout the period of residency."
          </p>
        </div>

        <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 30, textAlign: "center", paddingBottom: 15 }}>
           <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ borderTop: "2px solid #000", width: "100%", margin: "0 auto" }}></div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 8 }}>CLASS TEACHER</div>
           </div>
           
           <div style={{ position: "relative", height: 140 }}>
              <div style={{ 
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                width: 120, height: 120, border: "4px double #000", borderRadius: "50%",
                opacity: 0.1, display: "flex", alignItems: "center", justifyContent: "center", 
                fontSize: 11, fontWeight: 900, textAlign: "center"
              }}>
                OFFICIAL<br/>SCHOOL STAMP
              </div>
           </div>
           
           <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ borderTop: "2px solid #000", width: "100%", margin: "0 auto" }}></div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 8 }}>PRINCIPAL</div>
           </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, fontSize: 13, fontWeight: 700, padding: "0 8px" }}>
           <div>DATE OF ISSUE: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
           <div style={{ textTransform: "uppercase" }}>CERTIFICATE NO: {file.certificate_no || `SLC/${new Date().getFullYear()}/${student.adm}`}</div>
        </div>
      </div>
    </div>
  );
};
