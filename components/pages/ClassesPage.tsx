"use client";

import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/utils/supabase/client";

const STREAM_COLORS: Record<string, string> = {
  "1": "#16a34a",
  "2": "#2563eb",
  "3": "#d97706",
  "4": "#dc2626",
};

const STREAM_BG: Record<string, string> = {
  "1": "#f0fdf4",
  "2": "#eff6ff",
  "3": "#fffbeb",
  "4": "#fef2f2",
};

export const ClassesPage = ({ role, selectedYear }: { role: string, selectedYear: string }) => {
  const supabase = createClient();

  const [classes, setClasses] = useState<any[]>([]);
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStream, setExpandedStream] = useState<string>("1");

  // Add class form
  const [showAdd, setShowAdd] = useState(false);
  const [newLevel, setNewLevel] = useState("1");
  const [newSuffix, setNewSuffix] = useState("");   // e.g. "W", "East"
  const [newTeacherId, setNewTeacherId] = useState("");

  // Bulk add
  const [showBulk, setShowBulk] = useState(false);
  const [bulkLevel, setBulkLevel] = useState("1");
  const [bulkSuffixes, setBulkSuffixes] = useState(""); // e.g. "W, E, N, S"

  // Lesson management
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [newSubId, setNewSubId] = useState("");
  const [newTeacherCode, setNewTeacherCode] = useState("");
  const [newWeekly, setNewWeekly] = useState(5);
  const [applyToLevel, setApplyToLevel] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const { data: classData } = await supabase
      .from("classes")
      .select("id, name, level, profiles:class_teacher_id(full_name, code)")
      .order("level")
      .order("name");

    if (classData) {
      const mapped = await Promise.all(classData.map(async (c: any) => {
        const { count: sCount } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("class_id", c.id);
        const { count: lCount } = await supabase.from("teacher_lessons").select("id", { count: "exact", head: true }).eq("class_id", c.id);
        return {
          id: c.id,
          name: c.name,
          level: String(c.level || "1"),
          teacher: c.profiles?.full_name || "Unassigned",
          teacherCode: c.profiles?.code || "",
          studentCount: sCount || 0,
          lessonCount: lCount || 0,
        };
      }));
      setClasses(mapped);
    }

    const { data: teachers } = await supabase.from("profiles").select("id, full_name, code").in("role", ["teacher", "admin", "principal", "deputy"]).order("full_name");
    if (teachers) setAllTeachers(teachers);

    const { data: subjects } = await supabase.from("subjects").select("id, name").order("name");
    if (subjects) setAllSubjects(subjects);

    setLoading(false);
  };

  const fetchLessons = async (classId: string) => {
    const { data } = await supabase
      .from("teacher_lessons")
      .select("id, subjects(name), profiles:teacher_id(full_name, code)")
      .eq("class_id", classId);
    if (data) setLessons(data.map((l: any) => ({ id: l.id, subject: l.subjects?.name, teacher: l.profiles?.full_name, teacherCode: l.profiles?.code })));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAddClass = async () => {
    if (!newSuffix) return alert("Enter a class suffix (e.g. W, East, A).");
    const className = `${newLevel}${newSuffix.trim()}`;
    if (classes.find(c => c.name.toLowerCase() === className.toLowerCase())) return alert(`Class "${className}" already exists.`);
    const { error } = await supabase.from("classes").insert({
      name: className,
      level: newLevel,
      class_teacher_id: newTeacherId || null,
    });
    if (error) return alert("Error: " + error.message);
    setNewSuffix(""); setNewTeacherId(""); setShowAdd(false);
    await fetchAll();
  };

  const handleBulkAdd = async () => {
    const suffixes = bulkSuffixes.split(",").map(s => s.trim()).filter(Boolean);
    if (!suffixes.length) return alert("Enter class suffixes separated by commas.");
    let created = 0, skipped = 0;
    for (const s of suffixes) {
      const className = `${bulkLevel}${s}`;
      if (classes.find(c => c.name.toLowerCase() === className.toLowerCase())) { skipped++; continue; }
      const { error } = await supabase.from("classes").insert({ name: className, level: bulkLevel, class_teacher_id: null });
      if (!error) created++;
    }
    alert(`Created ${created} class(es). Skipped ${skipped} duplicate(s).`);
    setBulkSuffixes(""); setShowBulk(false);
    await fetchAll();
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if (!confirm(
      `⚠️ Delete class "${name}"?\n\n` +
      `This will permanently:\n` +
      `• Remove all exam results for this class\n` +
      `• Remove all lesson/teacher assignments\n` +
      `• Unassign all students (students are kept but moved to no class)\n\n` +
      `This cannot be undone!`
    )) return;

    try {
      // 1. Get all student IDs in this class
      const { data: sts } = await supabase.from("students").select("id").eq("class_id", id);
      const studentIds = (sts || []).map(s => s.id);

      // 2. Delete all results for those students
      if (studentIds.length > 0) {
        await supabase.from("results").delete().in("student_id", studentIds);
      }

      // 3. Delete teacher/lesson assignments
      await supabase.from("teacher_lessons").delete().eq("class_id", id);

      // 4. Unassign students from this class (keep students, just remove class link)
      await supabase.from("students").update({ class_id: null }).eq("class_id", id);

      // 5. Delete the class itself
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) return alert("Error deleting class: " + error.message);

      alert(`Class "${name}" and all linked data have been removed.`);
      await fetchAll();
    } catch (e: any) {
      alert("Unexpected error: " + e.message);
    }
  };

  const handleAssignLesson = async () => {
    if (!newSubId || !newTeacherCode || !selectedClassId) return alert("Select a subject and teacher.");
    const { data: profile } = await supabase.from("profiles").select("id").eq("code", newTeacherCode).single();
    if (!profile) return alert("Teacher code not found.");
    const currentClass = classes.find(c => c.id === selectedClassId);
    const targets = applyToLevel ? classes.filter(c => c.level === currentClass?.level) : [currentClass];
    const { error } = await supabase.from("teacher_lessons").upsert(
      targets.map(c => ({ class_id: c.id, subject_id: newSubId, teacher_id: profile.id, weekly_lessons: newWeekly })),
      { onConflict: "teacher_id,subject_id,class_id" }
    );
    if (error) return alert("Error: " + error.message);
    setNewSubId(""); setNewTeacherCode(""); setApplyToLevel(false);
    fetchLessons(selectedClassId);
    fetchAll();
  };

  const handleRemoveLesson = async (id: string) => {
    await supabase.from("teacher_lessons").delete().eq("id", id);
    if (selectedClassId) fetchLessons(selectedClassId);
  };

  const streamsByLevel = ["1", "2", "3", "4"].map(lvl => ({
    level: lvl,
    classes: classes.filter(c => c.level === lvl),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.forest, fontFamily: "'Playfair Display', serif" }}>Stream & Class Management</div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>Organise classes by stream (Form 1–4) and assign class teachers.</div>
        </div>
        {["admin"].includes(role) && (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setShowBulk(!showBulk); setShowAdd(false); }} style={{ background: COLORS.gold, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ⚡ Bulk Add Classes
            </button>
            <button onClick={() => { setShowAdd(!showAdd); setShowBulk(false); }} style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              + Add Single Class
            </button>
          </div>
        )}
      </div>

      {/* Single Add Form */}
      {showAdd && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,.08)", border: `2px solid ${COLORS.forest}20`, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.forest }}>➕ Register New Class</div>
            <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
              <Icon name="close" size={20} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Stream (Form)</label>
              <select value={newLevel} onChange={e => setNewLevel(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, background: "#fff" }}>
                {["1","2","3","4"].map(l => <option key={l} value={l}>Form {l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Class Suffix</label>
              <input value={newSuffix} onChange={e => setNewSuffix(e.target.value)} placeholder="e.g. W, East, A" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14 }} />
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>Class will be named: <b>{newLevel}{newSuffix || "?"}</b></div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Class Teacher</label>
              <select value={newTeacherId} onChange={e => setNewTeacherId(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, background: "#fff" }}>
                <option value="">-- Unassigned --</option>
                {allTeachers.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.code})</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button onClick={handleAddClass} style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontWeight: 700, cursor: "pointer" }}>Save Class</button>
            <button onClick={() => setShowAdd(false)} style={{ background: "#F3F4F6", color: COLORS.charcoal, border: "none", borderRadius: 10, padding: "12px 20px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bulk Add Form */}
      {showBulk && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,.08)", border: `2px solid ${COLORS.gold}30`, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.gold }}>⚡ Bulk Add Classes to a Stream</div>
            <button onClick={() => setShowBulk(false)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
              <Icon name="close" size={20} />
            </button>
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 20 }}>Enter suffixes separated by commas — e.g. <b>W, E, N, S</b> to create 1W, 1E, 1N, 1S</div>
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Stream (Form)</label>
              <select value={bulkLevel} onChange={e => setBulkLevel(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, background: "#fff" }}>
                {["1","2","3","4"].map(l => <option key={l} value={l}>Form {l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Class Suffixes (comma-separated)</label>
              <input value={bulkSuffixes} onChange={e => setBulkSuffixes(e.target.value)} placeholder="e.g.  W, E, N, S" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14 }} />
              {bulkSuffixes && (
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
                  Will create: <b>{bulkSuffixes.split(",").map(s => `${bulkLevel}${s.trim()}`).filter(s => s.length > 1).join(", ")}</b>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button onClick={handleBulkAdd} style={{ background: COLORS.gold, color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontWeight: 700, cursor: "pointer" }}>Create All Classes</button>
            <button onClick={() => setShowBulk(false)} style={{ background: "#F3F4F6", color: COLORS.charcoal, border: "none", borderRadius: 10, padding: "12px 20px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Stream Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
        {streamsByLevel.map(({ level, classes: sc }) => (
          <div
            key={level}
            onClick={() => setExpandedStream(level)}
            style={{
              background: expandedStream === level ? STREAM_COLORS[level] : "#fff",
              color: expandedStream === level ? "#fff" : COLORS.charcoal,
              borderRadius: 14, padding: "20px 16px", cursor: "pointer",
              border: `2px solid ${expandedStream === level ? STREAM_COLORS[level] : "#E5E7EB"}`,
              transition: "all 0.2s", textAlign: "center",
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Playfair Display', serif" }}>F{level}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, opacity: 0.8 }}>Form {level}</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 10 }}>{sc.length}</div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", opacity: 0.7 }}>Classes</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{sc.reduce((a, c) => a + c.studentCount, 0)} students</div>
          </div>
        ))}
      </div>

      {/* Class Grid for Selected Stream */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: COLORS.muted, background: "#fff", borderRadius: 20 }}>Loading classes...</div>
      ) : streamsByLevel.map(({ level, classes: sc }) => expandedStream === level && (
        <div key={level} style={{ background: STREAM_BG[level], borderRadius: 20, padding: 24, border: `2px solid ${STREAM_COLORS[level]}20` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: STREAM_COLORS[level] }}>Form {level} Stream — {sc.length} Class{sc.length !== 1 ? "es" : ""}</div>
          </div>

          {sc.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, background: "#fff", borderRadius: 16, border: "2px dashed #E5E7EB" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏫</div>
              <div style={{ fontWeight: 700 }}>No Form {level} classes yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Use "Bulk Add" or "Add Single Class" above to get started.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {sc.map(c => (
                <div key={c.id} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,.06)", border: `1px solid ${STREAM_COLORS[level]}20` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: STREAM_COLORS[level], fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>Form {c.level}</div>
                    </div>
                    {role === "admin" && (
                      <button onClick={() => handleDeleteClass(c.id, c.name)} style={{ color: "#dc2626", background: "#fef2f2", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        Delete
                      </button>
                    )}
                  </div>

                  <div style={{ marginTop: 12, fontSize: 13, color: COLORS.muted }}>
                    👨‍🏫 <span style={{ color: COLORS.gold, fontWeight: 600 }}>{c.teacher}</span>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <div style={{ flex: 1, textAlign: "center", padding: "10px 8px", borderRadius: 10, background: `${STREAM_COLORS[level]}10` }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: STREAM_COLORS[level] }}>{c.studentCount}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>Students</div>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", padding: "10px 8px", borderRadius: 10, background: "#fffbeb" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold }}>{c.lessonCount}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>Subjects</div>
                    </div>
                  </div>

                  <button
                    onClick={() => { setSelectedClassId(c.id); fetchLessons(c.id); }}
                    style={{ marginTop: 14, width: "100%", background: STREAM_COLORS[level], color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    Manage Subjects & Teacher
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Lesson Management Modal */}
      {selectedClassId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 24, padding: 32, width: "100%", maxWidth: 600, boxShadow: "0 24px 60px rgba(0,0,0,.25)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.forest, fontFamily: "'Playfair Display', serif" }}>
                📚 {classes.find(c => c.id === selectedClassId)?.name} — Subjects
              </div>
              <button onClick={() => setSelectedClassId(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 28, lineHeight: 1, color: COLORS.muted }}>&times;</button>
            </div>

            <div style={{ background: "#F9FAFB", padding: 20, borderRadius: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 16 }}>Assign Subject & Teacher</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <select value={newSubId} onChange={e => setNewSubId(e.target.value)} style={{ padding: "10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13 }}>
                  <option value="">-- Subject --</option>
                  {allSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={newTeacherCode} onChange={e => setNewTeacherCode(e.target.value)} style={{ padding: "10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13 }}>
                  <option value="">-- Teacher --</option>
                  {allTeachers.map(t => <option key={t.id} value={t.code}>{t.full_name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Weekly Lessons</label>
                <input 
                  type="number" 
                  min="1" max="40" 
                  value={newWeekly} 
                  onChange={e => setNewWeekly(parseInt(e.target.value) || 1)} 
                  style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <input type="checkbox" id="applyToLevel" checked={applyToLevel} onChange={e => setApplyToLevel(e.target.checked)} />
                <label htmlFor="applyToLevel" style={{ fontSize: 12, color: COLORS.muted, cursor: "pointer" }}>
                  Apply to ALL Form {classes.find(c => c.id === selectedClassId)?.level} classes
                </label>
              </div>
              <button onClick={handleAssignLesson} style={{ width: "100%", background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontWeight: 700, cursor: "pointer" }}>
                Assign Subject
              </button>
            </div>

            <div style={{ fontWeight: 700, color: COLORS.muted, fontSize: 11, textTransform: "uppercase", marginBottom: 12 }}>Current Assignments ({lessons.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lessons.length === 0 ? (
                <div style={{ textAlign: "center", color: COLORS.muted, padding: 24, fontSize: 14 }}>No subjects assigned yet.</div>
              ) : lessons.map(l => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, border: "1px solid #F3F4F6", background: "#fff" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{l.subject}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{l.teacher} ({l.teacherCode})</div>
                  </div>
                  <button onClick={() => handleRemoveLesson(l.id)} style={{ color: "#dc2626", background: "#fef2f2", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
