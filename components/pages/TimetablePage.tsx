"use client";

import React, { useState, useEffect, useCallback } from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";

// ─── CONSTANTS ─────────────────────────────────────────────────────────────
// ─── DEFAULT CONSTANTS (Fallback) ──────────────────────────────────────────
const DEFAULT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const DEFAULT_PERIOD_ROWS = [
  { name: "Morning Preps", type: "prep", startTime: "07:00", endTime: "08:20" },
  { name: "Period 1", type: "lesson", startTime: "08:20", endTime: "09:00", teachingIdx: 0 },
  { name: "Period 2", type: "lesson", startTime: "09:00", endTime: "09:40", teachingIdx: 1 },
  { name: "Period 3", type: "lesson", startTime: "09:40", endTime: "10:20", teachingIdx: 2 },
  { name: "Break",    type: "break",  startTime: "10:20", endTime: "10:40" },
  { name: "Period 4", type: "lesson", startTime: "10:40", endTime: "11:20", teachingIdx: 3 },
  { name: "Period 5", type: "lesson", startTime: "11:20", endTime: "12:00", teachingIdx: 4 },
  { name: "Lunch",    type: "break",  startTime: "12:00", endTime: "13:00" },
  { name: "Period 6", type: "lesson", startTime: "13:00", endTime: "13:40", teachingIdx: 5 },
  { name: "Period 7", type: "lesson", startTime: "13:40", endTime: "14:20", teachingIdx: 6 },
  { name: "Period 8", type: "lesson", startTime: "14:20", endTime: "15:00", teachingIdx: 7 },
  { name: "Period 9", type: "lesson", startTime: "15:00", endTime: "15:40", teachingIdx: 8 },
  { name: "Remedials", type: "prep", startTime: "16:00", endTime: "17:00" },
];

const PALETTE = [
  "#3B82F6","#8B5CF6","#10B981","#F59E0B","#EF4444",
  "#06B6D4","#F97316","#14B8A6","#6366F1","#EC4899",
  "#84CC16","#F43F5E","#0EA5E9","#A855F7","#22C55E",
];

// ─── TYPES ──────────────────────────────────────────────────────────────────
type SessionType = "lesson" | "break" | "prep";
type Session = { name: string; type: SessionType; startTime: string; endTime: string; teachingIdx?: number };
type Lesson = { subjectId: string; subjectName: string; teacherId: string; teacherName: string };
type SlotKey = `${string}_${number}`;
type TimetableCell = { subjectName: string; teacherName: string; teacherId: string; color: string };

type TeacherLessonRow = {
  id: string;
  teacher_id: string;
  subject_id: string;
  class_id: string;
  teacherName: string;
  subjectName: string;
  className: string;
  weekly_lessons: number;
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildLessonList(lessons: (Lesson & { weekly_lessons: number })[]): Lesson[] {
  const list: Lesson[] = [];
  lessons.forEach(l => {
    for (let r = 0; r < l.weekly_lessons; r++) {
      list.push({
        subjectId: l.subjectId,
        subjectName: l.subjectName,
        teacherId: l.teacherId,
        teacherName: l.teacherName
      });
    }
  });
  return list;
}

/**
 * Backtracking-based scheduler for a single class
 */
function scheduleWithBacktracking(
  lessonPool: Lesson[],
  teacherBusy: Map<string, Set<SlotKey>>,
  subjectColor: Map<string, string>,
  availableSlots: [string, number][],
  days: string[]
): Record<string, Record<number, TimetableCell>> | null {
  const result: Record<string, Record<number, TimetableCell>> = {};
  days.forEach(d => { result[d] = {}; });
  
  const classBusy = new Set<SlotKey>();
  
  // Backtracking function
  const solve = (lessonIdx: number): boolean => {
    if (lessonIdx === lessonPool.length) return true; // All lessons scheduled
    
    const lesson = lessonPool[lessonIdx];
    const shuffledSlots = shuffle([...availableSlots]);

    for (const [day, pi] of shuffledSlots) {
      const key: SlotKey = `${day}_${pi}`;
      const tb = teacherBusy.get(lesson.teacherId) ?? new Set<SlotKey>();
      
      // Hard Constraints:
      // 1. Teacher free
      // 2. Class free (implicitly via availableSlots loop and classBusy check)
      if (!classBusy.has(key) && !tb.has(key)) {
        
        // Soft Constraint: Avoid too many of the same subject per day
        const daySubjects = Object.values(result[day]).filter(c => c.subjectName === lesson.subjectName).length;
        if (daySubjects >= 2 && lessonPool.length > 20) { // arbitrary threshold for "too many"
           // continue; // try to optimize if possible, but don't fail yet
        }

        // Place lesson
        result[day][pi] = { 
          subjectName: lesson.subjectName, 
          teacherName: lesson.teacherName, 
          teacherId: lesson.teacherId, 
          color: subjectColor.get(lesson.subjectId) ?? "#9CA3AF" 
        };
        classBusy.add(key);
        tb.add(key);
        
        if (solve(lessonIdx + 1)) return true;
        
        // Backtrack
        delete result[day][pi];
        classBusy.delete(key);
        tb.delete(key);
      }
    }
    return false;
  };

  // Sort by teacher scarcity or some heuristic? Shuffling for now to reduce bias as requested.
  if (solve(0)) return result;
  return null; // Failed to schedule all lessons
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export const TimetablePage = ({ schoolSettings, selectedYear }: { schoolSettings?: any, selectedYear: string }) => {
  const supabase = createClient();

  // ── shared lookup data ──
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([]);

  // ── timetable view ──
  const [selectedClassId, setSelectedClassId] = useState("");
  const [savedTimetable, setSavedTimetable] = useState<Record<string, Record<number, TimetableCell>>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<{ msg: string; type: "success"|"error"|"info" }|null>(null);
  const [subjectColor] = useState<Map<string, string>>(new Map());

  // ── config state ──
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    lessons_per_day: 9,
    days_per_week: 5,
    has_weekend: false,
    weekend_days: [] as string[],
    structure: DEFAULT_PERIOD_ROWS,
    lesson_duration: 40,
    lesson_start_time: "08:00",
    school_days: DEFAULT_DAYS
  });

  const [weekendView, setWeekendView] = useState(false);
  const currentDays = config.has_weekend 
    ? (weekendView ? config.weekend_days : DEFAULT_DAYS)
    : DEFAULT_DAYS;
  
  const allScheduledDays = config.has_weekend ? [...DEFAULT_DAYS, ...config.weekend_days] : DEFAULT_DAYS;
  const teachingSessions = config.structure.filter(r => r.type === "lesson");
  const teachingSlotsPerDay = teachingSessions.length;
  const totalWeeklySlots = teachingSlotsPerDay * allScheduledDays.length;

  // ── assignments panel ──
  const [showAssign, setShowAssign] = useState(false);
  const [assignments, setAssignments] = useState<TeacherLessonRow[]>([]);
  const [assLoading, setAssLoading] = useState(false);

  // form state
  const [fTeacher, setFTeacher] = useState("");
  const [fSubject, setFSubject] = useState("");
  const [fClass, setFClass] = useState("");
  const [fWeekly, setFWeekly] = useState(1);
  const [saving, setSaving] = useState(false);
  const [prepSessions, setPrepSessions] = useState<any[]>([]);
  const [showPrepForm, setShowPrepForm] = useState(false);

  // ── view tab ──
  const [activeTab, setActiveTab] = useState<"class" | "teacher" | "special">("class");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [teacherTimetable, setTeacherTimetable] = useState<any[]>([]);
  const [allSlots, setAllSlots] = useState<any[]>([]);  // all saved slots for bulk ops

  // ── fetch all lookup data on mount ──
  useEffect(() => {
    const init = async () => {
      const { data: settings } = await supabase.from("timetable_settings").select("*").eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle();
      if (settings) {
        setConfig({
          ...settings,
          structure: typeof settings.structure === 'string' ? JSON.parse(settings.structure) : settings.structure
        });
      }

      const [{ data: cls }, { data: subs }, { data: tchs }] = await Promise.all([
        supabase.from("classes").select("id, name").order("name"),
        supabase.from("subjects").select("id, name").order("name"),
        supabase.from("profiles").select("id, full_name").in("role", ["teacher","principal","deputy"]).order("full_name"),
      ]);
      if (cls)  { setClasses(cls);  setSelectedClassId(cls[0]?.id ?? ""); setFClass(cls[0]?.id ?? ""); }
      if (subs) { setSubjects(subs); setFSubject(subs[0]?.id ?? ""); }
      if (tchs) { setTeachers(tchs); setFTeacher(tchs[0]?.id ?? ""); setSelectedTeacherId(tchs[0]?.id ?? ""); }
      setLoading(false);
    };
    init();
  }, [selectedYear]);

  // ── fetch saved timetable ──
  const fetchSavedSlots = useCallback(async (classId: string) => {
    if (!classId) return;
    setLoading(true);
    const { data, error } = await supabase.from("timetable_slots").select("day, period_index, subject_name, teacher_name, teacher_id").eq("class_id", classId);
    if (error) {
      console.error("fetchSavedSlots error:", error);
      setStatus({ msg: "Error fetching timetable: " + error.message, type: "error" });
    }
    const tt: Record<string, Record<number, TimetableCell>> = {};
    if (data) {
      data.forEach((s: any) => {
        if (!tt[s.day]) tt[s.day] = {};
        // Map coloring by subject name or id? Using name for now as it's what's saved
        const color = subjectColor.get(s.subject_name) || PALETTE[Math.abs(s.subject_name.split('').reduce((a:number,b:string)=>((a<<5)-a)+b.charCodeAt(0),0)) % PALETTE.length];
        tt[s.day][s.period_index] = { subjectName: s.subject_name, teacherName: s.teacher_name ?? "", teacherId: s.teacher_id ?? "", color };
      });
    }
    setSavedTimetable(tt);
    setLoading(false);
  }, [supabase, subjectColor]);

  useEffect(() => { fetchSavedSlots(selectedClassId); }, [selectedClassId, fetchSavedSlots]);

  // ── fetch all assignments (for the panel) ──
  const fetchAssignments = useCallback(async () => {
    setAssLoading(true);
    const { data } = await supabase.from("teacher_lessons").select(`
      id, teacher_id, subject_id, class_id, weekly_lessons,
      profiles:teacher_id ( full_name ),
      subjects:subject_id  ( name ),
      classes:class_id   ( name )
    `);
    if (data) {
      setAssignments(data.map((r: any) => ({
        id: r.id,
        teacher_id: r.teacher_id,
        subject_id: r.subject_id,
        class_id:   r.class_id,
        teacherName: r.profiles?.full_name ?? "—",
        subjectName: r.subjects?.name ?? "—",
        className:   r.classes?.name ?? "—",
        weekly_lessons: r.weekly_lessons ?? 0
      })));
    }
    setAssLoading(false);
  }, [supabase]);

  const fetchPrepSessions = useCallback(async () => {
    const { data } = await supabase.from("prep_remedial_sessions").select("*");
    if (data) setPrepSessions(data);
  }, [supabase]);

  useEffect(() => { 
    if (showAssign) fetchAssignments(); 
    fetchPrepSessions();
  }, [showAssign, fetchAssignments, fetchPrepSessions]);

  // ── Save assignment ──
  const handleAssign = async () => {
    if (!fTeacher || !fSubject || !fClass) return;
    setSaving(true);
    const { error } = await supabase.from("teacher_lessons").upsert(
      { teacher_id: fTeacher, subject_id: fSubject, class_id: fClass, weekly_lessons: fWeekly },
      { onConflict: "teacher_id,subject_id,class_id" }
    );
    if (error) alert("Error: " + error.message);
    else { await fetchAssignments(); }
    setSaving(false);
  };

  // ── Remove assignment ──
  const handleRemove = async (id: string) => {
    await supabase.from("teacher_lessons").delete().eq("id", id);
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  // ── Generate timetable ──
  const handleGenerate = async (onlySelectedClass = false) => {
    setGenerating(true);
    setStatus({ msg: "Fetching teacher assignments…", type: "info" });
    try {
      const { data: allLessons, error: le } = await supabase.from("teacher_lessons").select(`
        id, class_id, weekly_lessons,
        profiles:teacher_id ( id, full_name ),
        subjects:subject_id  ( id, name )
      `);
      if (le) {
        console.error("Supabase teacher_lessons fetch error:", le);
        throw new Error(le.message || "Failed to fetch teacher assignments");
      }
      console.log(`Found ${allLessons?.length || 0} total assignments in DB`);

      if (!allLessons || allLessons.length === 0) {
        setStatus({ msg: "No teacher assignments found. Go to Classes → Manage Subjects & Teacher to assign teachers first.", type: "error" });
        setGenerating(false);
        return;
      }

      let colIdx = 0;
      allLessons.forEach((l: any) => {
        const sname = l.subjects?.name;
        if (sname && !subjectColor.has(sname)) subjectColor.set(sname, PALETTE[colIdx++ % PALETTE.length]);
      });

      // Ensure teachingIdx is correct in structure
      let tIdx = 0;
      const updatedStructure = config.structure.map(s => s.type === "lesson" ? { ...s, teachingIdx: tIdx++ } : s);
      const updatedConfig = { ...config, structure: updatedStructure };

      const byClass = new Map<string, (Lesson & { weekly_lessons: number })[]>();
      allLessons.forEach((l: any) => {
        if (!l.class_id || !l.profiles?.id || !l.subjects?.id) return;
        const arr = byClass.get(l.class_id) ?? [];
        arr.push({ 
          subjectId: l.subjects.id, 
          subjectName: l.subjects.name, 
          teacherId: l.profiles.id, 
          teacherName: l.profiles.full_name,
          weekly_lessons: l.weekly_lessons ?? 0
        });
        byClass.set(l.class_id, arr);
      });

      console.log(`Assignments grouped into ${byClass.size} classes`);

      const teacherBusy = new Map<string, Set<SlotKey>>();
      const allGenerated = new Map<string, Record<string, Record<number, TimetableCell>>>();
      const standardOrder: [string, number][] = [];
      for (const day of allScheduledDays) for (let pi = 0; pi < teachingSlotsPerDay; pi++) standardOrder.push([day, pi]);
      const randomizedOrder = shuffle(standardOrder);

      // Save settings to DB if we are generating
      const { error: se } = await supabase.from("timetable_settings").upsert({
        id: '00000000-0000-0000-0000-000000000000',
        ...updatedConfig
      });
      if (se) console.warn("Supabase timetable_settings upsert error (non-critical):", se);

      if (totalWeeklySlots === 0) {
        throw new Error("Timetable structure has no lesson slots or no days selected. Check configuration.");
      }

      // Generate for ALL classes (or just selected)
      const classesToGen = onlySelectedClass
        ? (byClass.has(selectedClassId) ? [selectedClassId] : [])
        : Array.from(byClass.keys());

      const totalClasses = classesToGen.length;
      let done = 0;
      for (const cid of classesToGen) {
        const lessons = byClass.get(cid);
        if (!lessons || lessons.length === 0) {
          console.warn(`No lessons found for class ID: ${cid}`);
          continue;
        }
        const pool = buildLessonList(lessons);
        console.log(`Class ${cid}: Pool size = ${pool.length} lessons`);
        
        if (pool.length === 0) {
          console.warn(`Class ${cid} has assignments but total weekly lessons is 0. Skipping.`);
          continue;
        }

        const sched = scheduleWithBacktracking(pool, teacherBusy, subjectColor, randomizedOrder, allScheduledDays);
        if (!sched) {
          const className = classes.find(c => c.id === cid)?.name ?? cid;
          throw new Error(`Could not generate a conflict-free schedule for ${className}. Try adding more lesson slots or reducing weekly lessons in Assignments.`);
        }
        allGenerated.set(cid, sched);
        done++;
        setStatus({ msg: `Scheduling class ${done}/${totalClasses}…`, type: "info" });
      }

      setStatus({ msg: "Saving to database…", type: "info" });
      const upsertRows: any[] = [];
      for (const [cid, tt] of allGenerated.entries()) {
        for (const day of allScheduledDays) {
          for (let pi = 0; pi < teachingSlotsPerDay; pi++) {
            const cell = tt[day]?.[pi];
            if (cell) {
              const session = updatedConfig.structure.find(s => s.type === "lesson" && s.teachingIdx === pi);
              upsertRows.push({ 
                class_id: cid, 
                day, 
                period_index: pi, 
                subject_name: cell.subjectName, 
                teacher_id: cell.teacherId || null, 
                teacher_name: cell.teacherName || null,
                start_time: session?.startTime || null,
                end_time: session?.endTime || null
              });
            }
          }
        }
      }

      if (upsertRows.length > 0) {
        const { error: ue } = await supabase.from("timetable_slots").upsert(upsertRows, { onConflict: "class_id,day,period_index" });
        if (ue) {
          console.error("Supabase timetable_slots upsert error:", ue);
          throw new Error(ue.message || "Failed to save generated slots");
        }
      }

      await fetchSavedSlots(selectedClassId);
      await fetchAllSlots();
      setStatus({ msg: `✅ Timetable generated for ${allGenerated.size} class(es) covering ${upsertRows.length} slots.`, type: "success" });
    } catch (err: any) {
      console.error("Generation Error Details:", err);
      const errorMsg = err.message || (typeof err === "string" ? err : JSON.stringify(err));
      setStatus({ msg: "❌ " + errorMsg, type: "error" });
    }
    setGenerating(false);
  };

  // ── Clear ──
  const handleClear = async () => {
    if (!selectedClassId) return;
    setGenerating(true);
    setStatus({ msg: "Clearing…", type: "info" });
    const { error } = await supabase.from("timetable_slots").delete().eq("class_id", selectedClassId);
    if (error) setStatus({ msg: "❌ " + error.message, type: "error" });
    else { setSavedTimetable({}); setStatus({ msg: "Cleared.", type: "info" }); }
    setGenerating(false);
  };

  const hasData = Object.keys(savedTimetable).some(d => Object.keys(savedTimetable[d]).length > 0);

  // ── Fetch all slots (for teacher view + bulk download) ──
  const fetchAllSlots = useCallback(async () => {
    const { data } = await supabase.from("timetable_slots").select("class_id, day, period_index, subject_name, teacher_name, teacher_id");
    if (data) setAllSlots(data);
  }, [supabase]);

  // Derive teacher timetable from allSlots
  useEffect(() => {
    if (!selectedTeacherId) return;
    const rows = allSlots
      .filter(s => s.teacher_id === selectedTeacherId)
      .map(s => ({
        day: s.day,
        period: s.period_index,
        subject: s.subject_name,
        className: classes.find(c => c.id === s.class_id)?.name ?? s.class_id,
      }))
      .sort((a, b) => currentDays.indexOf(a.day) - currentDays.indexOf(b.day) || a.period - b.period);
    setTeacherTimetable(rows);
  }, [selectedTeacherId, allSlots, classes, currentDays]);

  useEffect(() => { fetchAllSlots(); }, [fetchAllSlots]);


  // Shared grid HTML builder (days=columns, periods=rows) — used for all timetable prints
  const buildGridHTML = (title: string, subtitle: string, slots: any[], cellFn: (day: string, pi: number) => string, targetDays: string[], headerColor = "#166534") => {
    const dayHeaders = targetDays.map(d => `<th style="padding:8px;background:${headerColor};color:#fff;font-size:12px;border:1px solid #ddd">${d}</th>`).join("");
    let lessonCounter = 0;
    const bodyRows = config.structure.map(row => {
      const isTeaching = row.type === "lesson";
      const actualPi = isTeaching ? lessonCounter++ : -1;
      const timeStr = `<div style="font-size:9px;font-weight:400;color:#666;margin-top:2px">${row.startTime} - ${row.endTime}</div>`;
      
      if (!isTeaching) {
        return `<tr><td style="padding:6px 8px;font-size:11px;font-weight:700;color:#888;background:#f5f5f5;border:1px solid #eee">${row.name}${timeStr}</td>${targetDays.map(() => `<td style="background:#f5f5f5;border:1px solid #eee;text-align:center;font-size:11px;color:#aaa">${row.type === "break" ? "☕ "+row.name : "📖 "+row.name}</td>`).join("")}</tr>`;
      }
      const cells = targetDays.map(day => `<td style="padding:6px;border:1px solid #eee;text-align:center;min-width:90px">${cellFn(day, actualPi)}</td>`).join("");
      return `<tr><td style="padding:6px 8px;font-size:11px;font-weight:700;background:#fafafa;border:1px solid #eee;white-space:nowrap">${row.name}${timeStr}</td>${cells}</tr>`;
    }).join("");

    const prepRows = prepSessions.filter(p => !p.class_id || p.class_id === selectedClassId).map(ps => {
      return `<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:6px;padding:8px;margin-bottom:8px;font-size:11px">
        <b>${ps.day} • ${ps.type === "prep" ? "Prep" : "Remedial"}</b>: ${ps.description} (${ps.start_time} - ${ps.end_time})
      </div>`;
    }).join("");

    return `<div style="page-break-after:always;margin-bottom:40px;font-family:sans-serif">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
        <div>
          <div style="font-size:13px;font-weight:700;color:#888;letter-spacing:1px;text-transform:uppercase">${schoolSettings?.school_name || "KENYA SCHOOL SMS"}</div>
          <div style="font-size:20px;font-weight:900;color:${headerColor}">${title}</div>
          <div style="font-size:12px;color:#666;margin-top:2px">${subtitle}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
        <thead><tr><th style="padding:8px;background:${headerColor};color:#fff;font-size:12px;border:1px solid #ddd;text-align:left;width:80px">Period</th>${dayHeaders}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      ${prepRows ? `<div style="border-top:2px solid #EEE;padding-top:12px"><h4 style="margin:0 0 8px 0;font-size:13px;color:#166534">Prep & Remedial Sessions</h4>${prepRows}</div>` : ""}
    </div>`;
  };

  const openPrint = (html: string) => {
    const w = window.open("", "_blank");
    if (w) { w.document.write(`<html><head><style>@media print{body{margin:16px}}</style></head><body>${html}<script>window.onload=()=>window.print();</script></body></html>`); w.document.close(); }
  };

  const handlePrintAllClasses = () => {
    const body = classes.map(cls => {
      const slots = allSlots.filter(s => s.class_id === cls.id);
      if (!slots.length) return "";
      return buildGridHTML(`Class ${cls.name}`, "Weekly Timetable", slots,
        (day, pi) => { const s = slots.find(x => x.day === day && x.period_index === pi); return s ? `<b style="color:#166534">${s.subject_name}</b><br><span style="font-size:10px;color:#888">${s.teacher_name ?? ""}</span>` : `<span style="color:#ddd">—</span>`; },
        allScheduledDays);
    }).join("");
    openPrint(body || "<p>No timetable data found.</p>");
  };

  const handlePrintAllTeachers = () => {
    const body = teachers.map(teacher => {
      const slots = allSlots.filter(s => s.teacher_id === teacher.id);
      if (!slots.length) return "";
      return buildGridHTML(`${teacher.full_name}`, "Teacher Weekly Timetable", slots,
        (day, pi) => { const s = slots.find(x => x.day === day && x.period_index === pi); const cls = classes.find(c => c.id === s?.class_id); return s ? `<b style="color:#2563eb">${s.subject_name}</b><br><span style="font-size:10px;color:#888">${cls?.name ?? ""}</span>` : `<span style="color:#ddd">—</span>`; },
        allScheduledDays, "#2563eb");
    }).join("");
    openPrint(body || "<p>No timetable data found.</p>");
  };

  const handlePrintSingleClass = () => {
    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls) return;
    const slots = allSlots.filter(s => s.class_id === selectedClassId);
    const html = buildGridHTML(`Class ${cls.name}`, (weekendView ? "Weekend Timetable" : "Weekly Timetable"), slots,
      (day, pi) => { const s = slots.find(x => x.day === day && x.period_index === pi); return s ? `<b style="color:#166534">${s.subject_name}</b><br><span style="font-size:10px;color:#888">${s.teacher_name ?? ""}</span>` : `<span style="color:#ddd">—</span>`; },
      currentDays);
    openPrint(html);
  };

  const handlePrintSingleTeacher = () => {
    const teacher = teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) return;
    const slots = allSlots.filter(s => s.teacher_id === selectedTeacherId);
    const html = buildGridHTML(`${teacher.full_name}`, (weekendView ? "Teacher Weekend Timetable" : "Teacher Weekly Timetable"), slots,
      (day, pi) => { const s = slots.find(x => x.day === day && x.period_index === pi); const cls = classes.find(c => c.id === s?.class_id); return s ? `<b style="color:#2563eb">${s.subject_name}</b><br><span style="font-size:10px;color:#888">${cls?.name ?? ""}</span>` : `<span style="color:#ddd">—</span>`; },
      currentDays, "#2563eb");
    openPrint(html);
  };
  const handlePrintSpecialSessions = () => {
    const cls = classes.find(c => c.id === selectedClassId);
    const displayDays = weekendView ? config.weekend_days : DEFAULT_DAYS;
    const prepsFiltered = prepSessions.filter(p => displayDays.includes(p.day) && (!selectedClassId || p.class_id === selectedClassId));
    
    let lessonsFiltered: any[] = [];
    if (weekendView) {
      lessonsFiltered = allSlots.filter(s => displayDays.includes(s.day) && (!selectedClassId || s.class_id === selectedClassId)).map(s => {
         const session = config.structure.filter(sc => sc.type === "lesson")[s.period_index];
         return {
           day: s.day,
           start_time: session?.startTime || "??:??",
           end_time: session?.endTime || "??:??",
           type: "lesson",
           description: `${s.subject_name} (${s.teacher_name || "No Teacher"})`,
           class_id: s.class_id
         };
      });
    }

    const combined = [...prepsFiltered, ...lessonsFiltered];
    if (combined.length === 0) return;

    const sessionRows = displayDays.map((day: string) => {
      const daySlots = combined.filter(p => p.day === day).sort((a,b) => a.start_time.localeCompare(b.start_time));
      if (daySlots.length === 0) return "";
      
      const slotsHtml = daySlots.map(ps => {
        let color = "#666";
        let bg = "#f9f9f9";
        if (ps.type === "prep") { color = "#166534"; bg = "#F0FDF4"; }
        else if (ps.type === "remedial") { color = "#1E40AF"; bg = "#EFF6FF"; }
        else if (ps.type === "lesson") { color = "#B45309"; bg = "#FFFBEB"; }

        return `
          <div style="border:1px solid #ddd;padding:8px;border-radius:4px;margin-bottom:4px;background:${bg}">
            <div style="font-size:10px;font-weight:700;color:${color}">${ps.type.toUpperCase()} • ${ps.start_time} - ${ps.end_time}</div>
            <div style="font-size:13px;font-weight:700">${ps.description}</div>
            <div style="font-size:11px;color:#888">${classes.find(c => c.id === ps.class_id)?.name || "All Classes"}</div>
          </div>
        `;
      }).join("");

      return `<tr><td style="padding:10px;border:1px solid #ddd;font-weight:700;background:#f9f9f9;width:100px">${day}</td><td style="padding:10px;border:1px solid #ddd">${slotsHtml}</td></tr>`;
    }).join("");

    const titlePrefix = weekendView ? "Weekend " : "";
    const title = cls ? `Class ${cls.name} ${titlePrefix}Special & Weekend Sessions` : `${titlePrefix}Special & Weekend Sessions`;
    const html = `
      <div style="font-family:sans-serif;padding:20px">
        <h2 style="margin:0 0 4px 0">${title}</h2>
        <div style="font-size:12px;color:#666;margin-bottom:20px">${schoolSettings?.school_name || "KENYA SCHOOL SMS"}</div>
        <table style="width:100%;border-collapse:collapse">
          ${sessionRows}
        </table>
      </div>
    `;
    openPrint(html);
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── MANAGE ASSIGNMENTS PANEL ── */}
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)", overflow: "hidden" }}>
        {/* Collapsible header */}
        <button
          onClick={() => setShowAssign(v => !v)}
          style={{
            width: "100%", background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="users" size={16} color={COLORS.forest} />
            <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.charcoal }}>Manage Teacher Assignments</span>
            <Badge type="info">{assignments.length} assigned</Badge>
          </div>
          <span style={{ fontSize: 18, color: COLORS.muted, transform: showAssign ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
        </button>

        {showAssign && (
          <div style={{ padding: "0 20px 20px", borderTop: "1px solid #F3F4F6" }}>
            {/* Assignment form */}
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
              {/* Teacher */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Teacher</label>
                <select value={fTeacher} onChange={e => setFTeacher(e.target.value)} style={selectStyle}>
                  <option value="">— select teacher —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Subject</label>
                <select value={fSubject} onChange={e => setFSubject(e.target.value)} style={selectStyle}>
                  <option value="">— select subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Class */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Class</label>
                <select value={fClass} onChange={e => setFClass(e.target.value)} style={selectStyle}>
                  <option value="">— select class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Weekly Lessons */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Lessons /Wk</label>
                <input 
                  type="number" 
                  min="1" 
                  max="40" 
                  value={fWeekly} 
                  onChange={e => setFWeekly(parseInt(e.target.value) || 1)} 
                  style={{ ...inputStyle, padding: "8px 12px" }} 
                />
              </div>

              {/* Assign button */}
              <button
                onClick={handleAssign}
                disabled={saving || !fTeacher || !fSubject || !fClass}
                style={{
                  background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10,
                  padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                  opacity: (!fTeacher || !fSubject || !fClass) ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Icon name="add" size={14} color="#fff" />
                {saving ? "Saving…" : "Assign"}
              </button>
            </div>

            {/* Assignments table */}
            {assLoading ? (
              <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>Loading assignments…</div>
            ) : assignments.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, fontSize: 13, background: COLORS.cream, borderRadius: 10, marginTop: 16 }}>
                No assignments yet. Use the form above to assign teachers to subjects per class.
              </div>
            ) : (
              <div style={{ marginTop: 16, borderRadius: 10, overflow: "hidden", border: "1px solid #F3F4F6" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: COLORS.cream }}>
                      {["Teacher", "Subject", "Class", "Lessons/Wk", ""].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(a => (
                      <tr key={a.id} style={{ borderTop: "1px solid #F3F4F6" }}
                        onMouseEnter={e => (e.currentTarget.style.background = COLORS.cream)}
                        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                      >
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: COLORS.charcoal }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: COLORS.forest, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12 }}>
                              {a.teacherName[0]}
                            </div>
                            {a.teacherName}
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <Badge type="info">{a.subjectName}</Badge>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <Badge type="success">{a.className}</Badge>
                        </td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: COLORS.charcoal }}>
                          {a.weekly_lessons}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          <button
                            onClick={() => handleRemove(a.id)}
                            style={{ background: "#FEF2F2", color: COLORS.red, border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── TIMETABLE CONTROLS ── */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={selectedClassId}
          onChange={e => setSelectedClassId(e.target.value)}
          style={{ background: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, boxShadow: "0 1px 3px rgba(0,0,0,.08)", cursor: "pointer", flex: 1, minWidth: 140 }}
        >
          {classes.length === 0
            ? <option value="">No classes in database</option>
            : classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
          }
        </select>

        <button
          onClick={() => setShowConfig(true)}
          disabled={generating || classes.length === 0}
          style={{
            background: generating ? COLORS.muted : COLORS.forest,
            color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px",
            fontSize: 13, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <Icon name="calendar" size={15} color="#fff" />
          {generating ? "Working…" : "⚡ Configuration & Generate"}
        </button>

        <button
          onClick={() => handleGenerate(true)}
          disabled={generating || !selectedClassId}
          style={{
            background: generating ? COLORS.muted : COLORS.gold,
            color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px",
            fontSize: 13, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer",
          }}
        >
          This Class Only
        </button>

        <button
          onClick={handleClear}
          disabled={generating || !hasData}
          style={{
            background: "#FEF2F2", color: COLORS.red, border: "1px solid #FECACA",
            borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 600,
            cursor: generating || !hasData ? "not-allowed" : "pointer", opacity: !hasData ? 0.5 : 1
          }}
        >
          Clear
        </button>
      </div>

      {/* ── TIMETABLE CONFIG MODAL ── */}
      {showConfig && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 500, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "24px 30px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: COLORS.forest, margin: 0 }}>Timetable Configuration</h3>
              <button onClick={() => setShowConfig(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: COLORS.muted }}>&times;</button>
            </div>
            
            <div style={{ padding: 30, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={labelStyle}>Daily Session Structure</label>
                  <button 
                    onClick={() => {
                      const last = config.structure[config.structure.length - 1];
                      const newSession: Session = { 
                        name: "New Session", 
                        type: "lesson", 
                        startTime: last?.endTime ?? "08:00", 
                        endTime: "09:00" 
                      };
                      setConfig(prev => ({ ...prev, structure: [...prev.structure, newSession] }));
                    }}
                    style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    + Add Session
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "#F9FAFB", padding: 12, borderRadius: 12, border: "1px solid #F3F4F6" }}>
                  {config.structure.map((s, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 80px auto", gap: 8, alignItems: "center" }}>
                      <input 
                        value={s.name || ""} 
                        onChange={e => {
                          const newer = [...config.structure];
                          newer[idx] = { ...newer[idx], name: e.target.value };
                          setConfig(prev => ({ ...prev, structure: newer }));
                        }}
                        placeholder="Name"
                        style={{ ...inputStyle, padding: "6px 10px", fontSize: 13 }}
                      />
                      <select 
                        value={s.type || "lesson"} 
                        onChange={e => {
                          const newer = [...config.structure];
                          newer[idx] = { ...newer[idx], type: e.target.value as SessionType };
                          setConfig(prev => ({ ...prev, structure: newer }));
                        }}
                        style={{ ...selectStyle, padding: "5px 8px" }}
                      >
                        <option value="lesson">Lesson</option>
                        <option value="break">Break</option>
                        <option value="prep">Prep</option>
                      </select>
                      <input 
                        type="time" 
                        value={s.startTime || ""} 
                        onChange={e => {
                          const newer = [...config.structure];
                          newer[idx] = { ...newer[idx], startTime: e.target.value };
                          setConfig(prev => ({ ...prev, structure: newer }));
                        }}
                        style={{ ...inputStyle, padding: "5px 4px", fontSize: 12 }}
                      />
                      <input 
                        type="time" 
                        value={s.endTime || ""} 
                        onChange={e => {
                          const newer = [...config.structure];
                          newer[idx] = { ...newer[idx], endTime: e.target.value };
                          setConfig(prev => ({ ...prev, structure: newer }));
                        }}
                        style={{ ...inputStyle, padding: "5px 4px", fontSize: 12 }}
                      />
                      <button 
                        onClick={() => setConfig(prev => ({ ...prev, structure: prev.structure.filter((_, i) => i !== idx) }))}
                        style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 16 }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Weekend Timetable</label>
                <div style={{ display: "flex", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={config.has_weekend} 
                      onChange={e => setConfig(prev => ({ ...prev, has_weekend: e.target.checked, weekend_days: e.target.checked ? ["Saturday"] : [] }))} 
                    />
                    Include Weekends
                  </label>
                  {config.has_weekend && (
                    <div style={{ display: "flex", gap: 10 }}>
                      {["Saturday", "Sunday"].map(day => (
                        <label key={day} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                          <input 
                            type="checkbox" 
                            checked={config.weekend_days.includes(day)}
                            onChange={e => {
                              const days = e.target.checked 
                                ? [...config.weekend_days, day]
                                : config.weekend_days.filter(d => d !== day);
                              setConfig(prev => ({ ...prev, weekend_days: days }));
                            }}
                          />
                          {day}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Prep & Remedial Section */}
              <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <label style={labelStyle}>Prep & Remedial Sessions</label>
                  <button 
                    onClick={() => setShowPrepForm(!showPrepForm)}
                    style={{ background: COLORS.cream, color: COLORS.forest, border: `1px solid ${COLORS.forest}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    {showPrepForm ? "Close Manager" : "Manage Prep/Remedial"}
                  </button>
                </div>

                {showPrepForm && (
                  <div style={{ background: "#F9FAFB", padding: 15, borderRadius: 12, border: "1px solid #F3F4F6", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 5 }}>Add or remove special sessions (Morning Preps, Evening Remedials, etc.)</div>
                    
                    {/* List existing */}
                    {prepSessions.map((ps, idx) => (
                      <div key={ps.id || idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px auto", gap: 6, background: "#fff", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.forest }}>{ps.type === "prep" ? "Prep" : "Remedial"} • {ps.day}</div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{ps.description}</div>
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.muted }}>{ps.start_time} - {ps.end_time}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.charcoal }}>{classes.find(c => c.id === ps.class_id)?.name || "All Classes"}</div>
                        <button 
                          onClick={async () => {
                            if (ps.id) await supabase.from("prep_remedial_sessions").delete().eq("id", ps.id);
                            fetchPrepSessions();
                          }}
                          style={{ color: COLORS.red, background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
                        >&times;</button>
                      </div>
                    ))}

                    {/* Quick Add */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
                      <select id="pDay" style={selectStyle}><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option><option>Sunday</option></select>
                      <input id="pStart" type="time" style={inputStyle} defaultValue="06:30" />
                      <input id="pEnd" type="time" style={inputStyle} defaultValue="07:30" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6 }}>
                      <select id="pType" style={selectStyle}><option value="prep">Prep</option><option value="remedial">Remedial</option></select>
                      <select id="pClass" style={selectStyle}>
                        <option value="">All Classes</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <input id="pDesc" placeholder="Description" style={inputStyle} />
                      <button 
                        onClick={async () => {
                          const day = (document.getElementById("pDay") as HTMLSelectElement).value;
                          const start = (document.getElementById("pStart") as HTMLInputElement).value;
                          const end = (document.getElementById("pEnd") as HTMLInputElement).value;
                          const type = (document.getElementById("pType") as HTMLSelectElement).value;
                          const desc = (document.getElementById("pDesc") as HTMLInputElement).value;
                          const cid = (document.getElementById("pClass") as HTMLSelectElement).value;
                          await supabase.from("prep_remedial_sessions").insert({
                            day, start_time: start, end_time: end, type, description: desc, class_id: cid || null
                          });
                          fetchPrepSessions();
                        }}
                        style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >Add</button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background: COLORS.cream, padding: 16, borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Visual Structure Preview</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {config.structure.map((s, i) => (
                    <div key={i} style={{ 
                      padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: s.type === "lesson" ? COLORS.forest : s.type === "break" ? "#fff" : COLORS.gold,
                      color: s.type === "lesson" ? "#fff" : COLORS.muted,
                      border: s.type === "break" ? "1px solid #E5E7EB" : "none"
                    }}>
                      {s.name} ({s.startTime})
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 12 }}>
                <button 
                  onClick={() => { handleGenerate(false); setShowConfig(false); }}
                  style={{ flex: 1, background: COLORS.forest, color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontWeight: 700, cursor: "pointer" }}
                >
                  Generate All
                </button>
                <button 
                  onClick={() => { handleGenerate(true); setShowConfig(false); }}
                  style={{ flex: 1, background: COLORS.gold, color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontWeight: 700, cursor: "pointer" }}
                >
                  Current Class Only
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 12, padding: 4, gap: 4 }}>
          {(["class", "teacher", "special"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "8px 20px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
              background: activeTab === tab ? (tab === "special" ? COLORS.gold : COLORS.forest) : "transparent",
              color: activeTab === tab ? "#fff" : COLORS.muted,
              transition: "all 0.2s",
            }}>
              {tab === "class" ? "📚 Class View" : tab === "teacher" ? "👨‍🏫 Teacher View" : "📖 Special & Weekend"}
            </button>
          ))}
        </div>
        
        {(activeTab === "class" || activeTab === "special") && config.has_weekend && (
          <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 12, padding: 4, gap: 4 }}>
            <button onClick={() => setWeekendView(false)} style={{
              padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
              background: !weekendView ? COLORS.gold : "transparent",
              color: !weekendView ? "#fff" : COLORS.muted,
            }}>Weekdays</button>
            <button onClick={() => setWeekendView(true)} style={{
              padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
              background: weekendView ? COLORS.gold : "transparent",
              color: weekendView ? "#fff" : COLORS.muted,
            }}>Weekends</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={handlePrintAllClasses} style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            📥 Download All (By Class)
          </button>
          <button onClick={handlePrintAllTeachers} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            📥 Download All (By Teacher)
          </button>
        </div>
      </div>

      {/* ── TIMETABLE VIEW CONTROLS ── */}
      {activeTab === "class" && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            style={{ background: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, boxShadow: "0 1px 3px rgba(0,0,0,.08)", cursor: "pointer", flex: 1, minWidth: 140 }}
          >
            {classes.length === 0
              ? <option value="">No classes in database</option>
              : classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
            }
          </select>

          <button onClick={handlePrintSingleClass} disabled={!hasData}
            style={{ background: COLORS.cream, color: COLORS.charcoal, border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="download" size={14} color={COLORS.charcoal} /> Print
          </button>
        </div>
      )}

      {activeTab === "teacher" && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)}
            style={{ background: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, boxShadow: "0 1px 3px rgba(0,0,0,.08)", cursor: "pointer", flex: 1, minWidth: 200 }}>
            <option value="">-- Select Teacher --</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
          <button onClick={handlePrintSingleTeacher}
            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="download" size={14} color="#fff" /> Print This Teacher
          </button>
        </div>
      )}

      {activeTab === "special" && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            style={{ background: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, boxShadow: "0 1px 3px rgba(0,0,0,.08)", cursor: "pointer", flex: 1, minWidth: 140 }}
          >
            <option value="">-- All Classes --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={handlePrintSpecialSessions} disabled={prepSessions.length === 0}
            style={{ background: COLORS.gold, color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="download" size={14} color="#fff" /> Print Special Sessions
          </button>
        </div>
      )}

      {/* ── SPECIAL SESSIONS GRID ── */}
      {activeTab === "special" && (
        <div style={{ background: "#FDFCF6", border: `1px solid ${COLORS.gold}44`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", background: COLORS.gold, color: "#fff", fontWeight: 800, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>📖 Special & Weekend Timetable</span>
            <span style={{ fontSize: 11, opacity: 0.9 }}>{selectedClassId ? `Filtering by ${classes.find(c => c.id === selectedClassId)?.name}` : "Showing All Classes"}</span>
          </div>
          
          <div style={{ padding: 20 }}>
            {(() => {
              const displayDays = weekendView ? ["Saturday", "Sunday"] : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
              
              // Get Prep sessions
              const prepsFiltered = prepSessions.filter(p => displayDays.includes(p.day) && (!selectedClassId || p.class_id === selectedClassId));
              
              // Get regular slots for weekends only (if in weekend view)
              let lessonsFiltered: any[] = [];
              if (weekendView) {
                lessonsFiltered = allSlots.filter(s => displayDays.includes(s.day) && (!selectedClassId || s.class_id === selectedClassId)).map(s => {
                   const session = config.structure.filter(sc => sc.type === "lesson")[s.period_index];
                   return {
                     ...s,
                     isRegular: true,
                     startTime: session?.startTime || "??:??",
                     endTime: session?.endTime || "??:??",
                     type: "lesson",
                     description: `${s.subject_name} (${s.teacher_name || "No Teacher"})`
                   };
                });
              }

              // Combine and group
              const combined = [...prepsFiltered, ...lessonsFiltered];

              if (combined.length === 0) return (
                <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>
                  {weekendView ? "No weekend classes or special sessions scheduled." : "No weekday special sessions scheduled."}
                </div>
              );
              
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                  {displayDays.map(day => {
                    const dayItems = combined.filter(p => p.day === day);
                    if (dayItems.length === 0) return null;
                    return (
                      <div key={day} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                        <div style={{ background: "#F3F4F6", padding: "8px 12px", fontSize: 12, fontWeight: 800, color: COLORS.charcoal }}>{day}</div>
                        <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                          {dayItems.sort((a,b) => (a.startTime || a.start_time).localeCompare(b.startTime || b.start_time)).map((item, idx) => {
                            const isPrep = item.type === "prep";
                            const isRemedial = item.type === "remedial";
                            const isLesson = item.type === "lesson";
                            
                            let bg = "#F3F4F6";
                            let border = "#E5E7EB";
                            let accent = COLORS.muted;
                            
                            if (isPrep) { bg = "#F0FDF4"; border = "#BBF7D0"; accent = "#166534"; }
                            else if (isRemedial) { bg = "#EFF6FF"; border = "#BFDBFE"; accent = "#1E40AF"; }
                            else if (isLesson) { bg = "#FFFBEB"; border = "#FEF3C7"; accent = "#B45309"; }

                            return (
                              <div key={item.id || idx} style={{ padding: 10, borderRadius: 8, background: bg, border: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: "uppercase" }}>{item.type}</div>
                                  <div style={{ fontSize: 13, fontWeight: 800 }}>{item.description}</div>
                                  <div style={{ fontSize: 11, opacity: 0.8 }}>{classes.find(c => c.id === item.class_id)?.name || "All Classes"}</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: 12, fontWeight: 700 }}>{item.startTime || item.start_time}</div>
                                  <div style={{ fontSize: 10, opacity: 0.6 }}>to {item.endTime || item.end_time}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Status banner */}
      {status && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
          background: status.type === "success" ? "#F0FDF4" : status.type === "error" ? "#FEF2F2" : "#EFF6FF",
          color: status.type === "success" ? "#166534" : status.type === "error" ? "#991B1B" : "#1E40AF",
          border: `1px solid ${status.type === "success" ? "#BBF7D0" : status.type === "error" ? "#FECACA" : "#BFDBFE"}`,
        }}>
          {status.msg}
        </div>
      )}

      {/* ── CLASS TIMETABLE GRID ── */}
      {activeTab === "class" && (loading ? (
        <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, background: "#fff", borderRadius: 16 }}>Loading timetable…</div>
      ) : !hasData ? (
        <div style={{ padding: 48, textAlign: "center", color: COLORS.muted, background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.charcoal, marginBottom: 6 }}>No timetable yet</div>
          <div style={{ fontSize: 13 }}>
            Go to <strong>Classes</strong> → Manage Subjects &amp; Teacher to assign teachers,<br />
            then click <strong>⚡ Generate ALL Classes</strong>.
          </div>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead>
              <tr style={{ background: COLORS.forest }}>
                <th style={{ padding: "12px 16px", textAlign: "left", color: "#fff", fontSize: 12, fontWeight: 700, width: 88 }}>Period</th>
                {currentDays.map(d => (
                  <th key={d} style={{ padding: "12px 16px", textAlign: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                let lessonCounter = 0;
                return config.structure.map((row, rowIdx) => {
                  const isLesson = row.type === "lesson";
                  const actualPi = isLesson ? lessonCounter++ : -1;
                  return (
                    <tr key={rowIdx} style={{ borderBottom: "1px solid #F3F4F6", background: !isLesson ? "#FAFAFA" : "#fff" }}>
                      <td style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: !isLesson ? COLORS.muted : COLORS.charcoal, fontFamily: "'IBM Plex Mono', monospace", background: !isLesson ? "#F3F4F6" : undefined }}>
                        <div style={{ fontWeight: 800 }}>{row.name}</div>
                        <div style={{ fontSize: 9, opacity: 0.7, fontWeight: 400 }}>{row.startTime} - {row.endTime}</div>
                      </td>
                      {currentDays.map(day => {
                        if (!isLesson) return (
                          <td key={day} style={{ textAlign: "center", background: "#F3F4F6", padding: "8px" }}>
                            <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>
                              {row.type === "break" ? `☕ ${row.name}` : `📖 ${row.name}`}
                            </div>
                          </td>
                        );
                        
                        const cell = savedTimetable[day]?.[actualPi];
                        return (
                          <td key={day} style={{ padding: "5px" }}>
                            {cell ? (
                              <div style={{ background: cell.color + "18", border: `1px solid ${cell.color}45`, borderRadius: 8, padding: "6px 8px", minHeight: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: cell.color, textAlign: "center" }}>{cell.subjectName}</div>
                                {cell.teacherName && <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 500, textAlign: "center" }}>{cell.teacherName}</div>}
                              </div>
                            ) : (
                              <div style={{ minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ width: 20, height: 2, background: "#E5E7EB", borderRadius: 1 }} />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      ))}

      {/* ── TEACHER TIMETABLE VIEW ── */}
      {activeTab === "teacher" && (
        <div style={{ background: "#fff", borderRadius: 16, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          {!selectedTeacherId ? (
            <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>Select a teacher above to view their timetable.</div>
          ) : allSlots.filter(s => s.teacher_id === selectedTeacherId).length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 700 }}>No timetable found for this teacher</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Generate timetables first using the Class View tab.</div>
            </div>
          ) : (
            <>
              <div style={{ padding: "16px 20px 0", fontWeight: 800, fontSize: 16, color: "#2563eb" }}>
                👨‍🏫 {teachers.find(t => t.id === selectedTeacherId)?.full_name} — Weekly Schedule
                <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.muted, marginLeft: 12 }}>
                  {allSlots.filter(s => s.teacher_id === selectedTeacherId).length} periods/week
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620, margin: "12px 0 0" }}>
                <thead>
                  <tr style={{ background: "#2563eb" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", color: "#fff", fontSize: 12, fontWeight: 700, width: 88 }}>Period</th>
                    {currentDays.map(d => (
                      <th key={d} style={{ padding: "12px 16px", textAlign: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lessonCounter = 0;
                    return config.structure.map((row, rowIdx) => {
                      const isLesson = row.type === "lesson";
                      const actualPi = isLesson ? lessonCounter++ : -1;
                      const teacherSlots = allSlots.filter(s => s.teacher_id === selectedTeacherId);
                      return (
                        <tr key={rowIdx} style={{ borderBottom: "1px solid #F3F4F6", background: !isLesson ? "#FAFAFA" : "#fff" }}>
                          <td style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: !isLesson ? COLORS.muted : COLORS.charcoal, fontFamily: "'IBM Plex Mono', monospace", background: !isLesson ? "#F3F4F6" : undefined }}>
                            <div style={{ fontWeight: 800 }}>{row.name}</div>
                            <div style={{ fontSize: 9, opacity: 0.7, fontWeight: 400 }}>{row.startTime} - {row.endTime}</div>
                          </td>
                          {currentDays.map(day => {
                            if (!isLesson) return (
                              <td key={day} style={{ textAlign: "center", background: "#F3F4F6", padding: "8px" }}>
                                <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>
                                  {row.type === "break" ? `☕ ${row.name}` : `📖 ${row.name}`}
                                </div>
                              </td>
                            );
                            const slot = teacherSlots.find(s => s.day === day && s.period_index === actualPi);
                            const className = classes.find(c => c.id === slot?.class_id)?.name;
                            return (
                              <td key={day} style={{ padding: "5px" }}>
                                {slot ? (
                                  <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "6px 8px", minHeight: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textAlign: "center" }}>{slot.subject_name}</div>
                                    <div style={{ fontSize: 10, color: COLORS.forest, fontWeight: 700, textAlign: "center", background: "#F0FDF4", padding: "2px 6px", borderRadius: 4 }}>{className}</div>
                                  </div>
                                ) : (
                                  <div style={{ minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <div style={{ width: 20, height: 2, background: "#E5E7EB", borderRadius: 1 }} />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// small shared styles
const selectStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: "1px solid #E5E7EB", fontSize: 13, background: "#fff",
  cursor: "pointer", outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, color: COLORS.muted,
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1px solid #E5E7EB", fontSize: 14, outline: "none",
  boxSizing: "border-box"
};
