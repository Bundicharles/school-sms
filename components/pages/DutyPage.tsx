"use client";

import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/utils/supabase/client";

export const DutyPage = ({ role, selectedYear }: { role: string, selectedYear: string }) => {
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  
  // Generation Settings
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [teachersPerDay, setTeachersPerDay] = useState(2);
  const [teachersPerNight, setTeachersPerNight] = useState(1);
  const [restDays, setRestDays] = useState(2);
  
  // Custom Timings
  const [dayStart, setDayStart] = useState("08:00");
  const [dayEnd, setDayEnd] = useState("17:00");
  const [nightStart, setNightStart] = useState("17:00");
  const [nightEnd, setNightEnd] = useState("08:00");
  const [rotationFreq, setRotationFreq] = useState(3); // Duty Interval
  
  const [viewMode, setViewMode] = useState<"cards" | "compiled">("cards");
  const [stats, setStats] = useState<Record<string, any>>({});

  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);
    // 1. Fetch all teachers
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, code')
      .in('role', ['teacher', 'admin', 'principal', 'deputy'])
      .like('code', 'TR%');
    
    if (profiles) setTeachers(profiles);

    // 2. Fetch existing roster (next 30 days)
    const today = new Date().toISOString().split('T')[0];
    const { data: rosterData } = await supabase
      .from('duty_roster')
      .select('*, profiles(full_name, code)')
      .gte('duty_date', today)
      .order('duty_date', { ascending: true });
    
    if (rosterData) {
      setRoster(rosterData.map(r => ({
        ...r,
        teacherName: r.profiles?.full_name,
        teacherCode: r.profiles?.code
      })));
    }

    // 3. Fetch stats
    const { data: statsData } = await supabase.from('teacher_duty_stats').select('*');
    if (statsData) {
      const sMap: Record<string, any> = {};
      statsData.forEach(s => sMap[s.teacher_id] = s);
      setStats(sMap);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  const generateRoster = async () => {
    if (!startDate || !endDate) {
      alert("Please select a start and end date.");
      return;
    }

    if (teachers.length === 0) {
      alert("No teachers found in database to assign.");
      return;
    }

    setLoading(true);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days: string[] = [];
    let curr = new Date(start);
    while (curr <= end) {
      days.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    // Working copies for in-memory algorithm
    const currentStats = { ...stats };
    teachers.forEach(t => {
      if (!currentStats[t.id]) {
        currentStats[t.id] = { 
          teacher_id: t.id, total_duties: 0, day_duties: 0, night_duties: 0, last_duty_date: null 
        };
      }
    });

    // 1. Group teachers into fixed sets/pairs
    // We shuffle once at the start to ensure variety, then rotate through the sets
    const shuffledPool = [...teachers].sort(() => Math.random() - 0.5);
    const setSize = Math.max(1, teachersPerDay + teachersPerNight); // Total teachers needed per interval
    const dutySets: any[][] = [];
    
    for (let i = 0; i < shuffledPool.length; i += setSize) {
      dutySets.push(shuffledPool.slice(i, i + setSize));
    }

    // 2. Clear existing entries in the range to avoid unique constraint violations
    await supabase.from('duty_roster').delete().gte('duty_date', startDate).lte('duty_date', endDate);

    const newEntries: any[] = [];
    let setIndex = 0;

    // Process days in blocks of 'rotationFreq'
    for (let i = 0; i < days.length; i += rotationFreq) {
      const blockDays = days.slice(i, i + rotationFreq);
      
      // Get the next set of teachers from our round-robin pool
      const currentSet = dutySets[setIndex % dutySets.length];
      setIndex++;

      // Split the set into Day and Night subgroups
      const daySubgroup = currentSet.slice(0, teachersPerDay);
      const nightSubgroup = currentSet.slice(teachersPerDay, teachersPerDay + teachersPerNight);

      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      const pairId = generateUUID(); // Same pair ID for the whole set in this interval

      // 3. Assign
      blockDays.forEach(day => {
        daySubgroup.forEach(t => {
          newEntries.push({ 
            teacher_id: t.id, duty_date: day, shift: 'Day', pair_id: pairId,
            start_time: dayStart, end_time: dayEnd
          });
          // Update stats
          const s = currentStats[t.id];
          s.total_duties++;
          s.day_duties++;
          s.last_duty_date = day;
        });
        nightSubgroup.forEach(t => {
          newEntries.push({ 
            teacher_id: t.id, duty_date: day, shift: 'Night', pair_id: pairId,
            start_time: nightStart, end_time: nightEnd
          });
          // Update stats
          const s = currentStats[t.id];
          s.total_duties++;
          s.night_duties++;
          s.last_duty_date = day;
        });
      });
    }

    // Save to DB
    const { error: rosterErr } = await supabase.from('duty_roster').insert(newEntries);
    if (rosterErr) {
      alert("Error: " + rosterErr.message);
    } else {
      // Batch update stats
      const statsToUpdate = Object.values(currentStats);
      const { error: statsErr } = await supabase.from('teacher_duty_stats').upsert(statsToUpdate);
      if (statsErr) console.error("Stats update error:", statsErr);
      
      alert(`Generated ${newEntries.length} assignments using fixed-set rotation.`);
      fetchData();
    }
    setLoading(false);
  };

  const clearRoster = async () => {
    if (!confirm("Are you sure you want to clear the upcoming roster? Statistics will be updated.")) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch to-be-deleted records to update stats
    const { data: toDelete } = await supabase.from('duty_roster').select('*').gte('duty_date', today);
    if (toDelete && toDelete.length > 0) {
      const currentStats = { ...stats };
      toDelete.forEach(d => {
        const s = currentStats[d.teacher_id];
        if (s) {
          s.total_duties = Math.max(0, (s.total_duties || 0) - 1);
          if (d.shift === 'Day') s.day_duties = Math.max(0, (s.day_duties || 0) - 1);
          else s.night_duties = Math.max(0, (s.night_duties || 0) - 1);
        }
      });
      await supabase.from('teacher_duty_stats').upsert(Object.values(currentStats));
    }

    const { error } = await supabase.from('duty_roster').delete().gte('duty_date', today);
    if (error) alert(error.message);
    else fetchData();
    setLoading(false);
  };

  const resetAllHistory = async () => {
    if (!confirm("Are you sure you want to PERMANENTLY delete ALL duty records and RESET ALL statistics?")) return;
    setLoading(true);
    
    // 1. Delete all duties
    await supabase.from('duty_roster').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // 2. Reset stats for all teachers
    const resetStats = teachers.map(t => ({
      teacher_id: t.id,
      total_duties: 0,
      day_duties: 0,
      night_duties: 0,
      last_duty_date: null
    }));
    await supabase.from('teacher_duty_stats').upsert(resetStats);

    alert("All duty history and fairness metrics have been reset.");
    fetchData();
    setLoading(false);
  };

  const pruneExpiredDuties = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('duty_roster').delete().lt('duty_date', today);
    if (error) alert(error.message);
    else {
      alert("Expired duty history cleaned.");
      fetchData();
    }
    setLoading(false);
  };

  const deleteDuty = async (id: string, teacherId: string, shift: string, date: string) => {
    if (!confirm("Remove this duty assignment? Statistics will be updated.")) return;
    setLoading(true);
    
    // 1. Delete from roster
    const { error } = await supabase.from('duty_roster').delete().eq('id', id);
    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    // 2. Update stats (Decrement)
    const s = stats[teacherId];
    if (s) {
      const updatedS = {
        ...s,
        total_duties: Math.max(0, (s.total_duties || 0) - 1),
        [shift.toLowerCase() === 'day' ? 'day_duties' : 'night_duties']: Math.max(0, (s[shift.toLowerCase() === 'day' ? 'day_duties' : 'night_duties'] || 0) - 1)
      };
      await supabase.from('teacher_duty_stats').upsert(updatedS);
    }
    
    fetchData();
    setLoading(false);
  };

  const handlePrintRoster = () => {
    const html = `
      <div style="font-family:sans-serif;padding:20px">
        <h2 style="margin:0 0 10px 0;color:#166534">Upcoming Duty Schedule (Interval View)</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:20px">
          <thead>
            <tr style="background:#166534;color:#fff">
              <th style="padding:10px;border:1px solid #ddd;text-align:left">Date Interval</th>
              <th style="padding:10px;border:1px solid #ddd;text-align:left">Shift</th>
              <th style="padding:10px;border:1px solid #ddd;text-align:left">Assigned Teachers</th>
              <th style="padding:10px;border:1px solid #ddd;text-align:left">Times</th>
            </tr>
          </thead>
          <tbody>
            ${groupedRoster.map(g => `
              <tr>
                <td style="padding:12px;border:1px solid #ddd;font-weight:700">
                  ${new Date(g.startDate).toLocaleDateString()} - ${new Date(g.endDate).toLocaleDateString()}
                </td>
                <td style="padding:12px;border:1px solid #ddd">
                  ${g.shift}
                </td>
                <td style="padding:12px;border:1px solid #ddd">
                  ${g.teachers.map((t: any) => t.name).join(', ')}
                </td>
                <td style="padding:12px;border:1px solid #ddd">
                  ${g.start_time ? `${g.start_time} - ${g.end_time}` : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<html><head><title>Duty Roster</title></head><body>${html}</body></html>`);
      win.document.close();
      win.print();
    }
  };

  // Process roster to group by interval and pair
  const groupedRoster = React.useMemo(() => {
    const groups: Record<string, any> = {};
    roster.forEach(r => {
      const key = `${r.pair_id}_${r.shift}`;
      if (!groups[key]) {
        groups[key] = {
          pair_id: r.pair_id,
          shift: r.shift,
          teachers: [],
          dates: [],
          start_time: r.start_time,
          end_time: r.end_time
        };
      }
      if (!groups[key].teachers.find((t: any) => t.id === r.teacher_id)) {
        groups[key].teachers.push({ id: r.teacher_id, name: r.teacherName, code: r.teacherCode });
      }
      groups[key].dates.push(r.duty_date);
    });

    return Object.values(groups).map((g: any) => {
      const sortedDates = [...g.dates].sort();
      return {
        ...g,
        startDate: sortedDates[0],
        endDate: sortedDates[sortedDates.length - 1]
      };
    }).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [roster]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.forest, fontFamily: "'Playfair Display', serif" }}>Teacher on Duty (TOD) Roster</div>
          <div style={{ fontSize: 13, color: COLORS.muted }}>Manage and generate duty schedules for staff members.</div>
        </div>
        {role === "admin" && (
           <div style={{ display: "flex", gap: 10 }}>
             <button onClick={handlePrintRoster} disabled={roster.length === 0} style={{ background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: roster.length === 0 ? 0.6 : 1 }}>
               🖨️ Print Roster
             </button>
             <button onClick={pruneExpiredDuties} style={{ background: COLORS.gold, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
               Clean Expired
             </button>
             <button onClick={clearRoster} style={{ background: COLORS.red, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
               Clear Upcoming
             </button>
             <button onClick={resetAllHistory} style={{ background: "#000", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
               Reset All
             </button>
           </div>
        )}
      </div>

      {/* Generator Controls */}
      {role === "admin" && (
        <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,.05)", border: `1px solid ${COLORS.forest}15` }}>
           <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: COLORS.forest, display: "flex", alignItems: "center", gap: 8 }}>
             <Icon name="calendar" size={18} color={COLORS.forest} /> Generate Automatic Roster
           </div>
           <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Start Date</label>
                <input type="date" value={startDate || ""} onChange={e=>setStartDate(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #E5E7EB" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 8 }}>End Date</label>
                <input type="date" value={endDate || ""} onChange={e=>setEndDate(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #E5E7EB" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Teachers / Day</label>
                <input type="number" value={teachersPerDay} onChange={e=>setTeachersPerDay(parseInt(e.target.value))} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #E5E7EB" }} />
              </div>
              <div>
                <label style={labelStyle}>Teachers / Night</label>
                <input type="number" value={teachersPerNight} onChange={e=>setTeachersPerNight(parseInt(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Duty Interval (Days)</label>
                <input type="number" value={rotationFreq} onChange={e=>setRotationFreq(parseInt(e.target.value))} placeholder="Same teachers for N days" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Rest Period (Days)</label>
                <input type="number" value={restDays} onChange={e=>setRestDays(parseInt(e.target.value))} placeholder="Min gap between duties" style={inputStyle} />
              </div>
           </div>

           <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginTop: 20, paddingTop: 20, borderTop: "1px solid #F3F4F6" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={labelStyle}>☀️ Day Shift Times</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="time" value={dayStart} onChange={e=>setDayStart(e.target.value)} style={inputStyle} />
                  <span style={{ color: COLORS.muted }}>to</span>
                  <input type="time" value={dayEnd} onChange={e=>setDayEnd(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={labelStyle}>🌙 Night Shift Times</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="time" value={nightStart} onChange={e=>setNightStart(e.target.value)} style={inputStyle} />
                  <span style={{ color: COLORS.muted }}>to</span>
                  <input type="time" value={nightEnd} onChange={e=>setNightEnd(e.target.value)} style={inputStyle} />
                </div>
              </div>
           </div>
           <button onClick={generateRoster} disabled={loading} style={{ 
             marginTop: 24, width: "100%", background: COLORS.forest, color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontWeight: 700, cursor: "pointer",
             opacity: loading ? 0.7 : 1
           }}>
             {loading ? "Generating..." : "Generate and Save Roster"}
           </button>
        </div>
      )}

      {/* Statistics View */}
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
         <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: COLORS.charcoal, display: "flex", alignItems: "center", gap: 8 }}>
           📊 Teacher Duty Statistics <span style={{ fontSize: 11, fontWeight: 400, color: COLORS.muted }}>(Fairness metrics)</span>
         </div>
         <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
               <thead>
                 <tr style={{ textAlign: "left", borderBottom: "2px solid #F3F4F6" }}>
                   <th style={{ padding: "12px", fontSize: 12, color: COLORS.muted }}>TEACHER</th>
                   <th style={{ padding: "12px", fontSize: 12, color: COLORS.muted }}>TOTAL</th>
                   <th style={{ padding: "12px", fontSize: 12, color: COLORS.muted }}>DAY</th>
                   <th style={{ padding: "12px", fontSize: 12, color: COLORS.muted }}>NIGHT</th>
                   <th style={{ padding: "12px", fontSize: 12, color: COLORS.muted }}>LAST DUTY</th>
                 </tr>
               </thead>
               <tbody>
                  {teachers.slice(0, 10).map(t => {
                    const s = stats[t.id] || {};
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "12px", fontSize: 13, fontWeight: 700 }}>{t.full_name}</td>
                        <td style={{ padding: "12px", fontSize: 13, fontWeight: 700, color: COLORS.forest }}>{s.total_duties || 0}</td>
                        <td style={{ padding: "12px", fontSize: 13 }}>{s.day_duties || 0}</td>
                        <td style={{ padding: "12px", fontSize: 13 }}>{s.night_duties || 0}</td>
                        <td style={{ padding: "12px", fontSize: 12, color: COLORS.muted }}>{s.last_duty_date ? new Date(s.last_duty_date).toLocaleDateString() : 'Never'}</td>
                      </tr>
                    );
                  })}
               </tbody>
            </table>
            {teachers.length > 10 && <div style={{ padding: 10, textAlign: "center", fontSize: 12, color: COLORS.muted }}>... and {teachers.length - 10} more teachers</div>}
         </div>
      </div>

      {/* Roster View */}
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
           <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.charcoal }}>Upcoming Duty Schedule (Interval View)</div>
           <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 8, padding: 4, gap: 4 }}>
              <button 
                onClick={() => setViewMode("cards")}
                style={{ background: viewMode === "cards" ? "#fff" : "transparent", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: viewMode === "cards" ? "0 1px 2px rgba(0,0,0,0.1)" : "none" }}>
                🎴 Cards
              </button>
              <button 
                onClick={() => setViewMode("compiled")}
                style={{ background: viewMode === "compiled" ? "#fff" : "transparent", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: viewMode === "compiled" ? "0 1px 2px rgba(0,0,0,0.1)" : "none" }}>
                📋 Compiled
              </button>
           </div>
         </div>

         {viewMode === "cards" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
             {groupedRoster.length === 0 ? (
               <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: COLORS.muted }}>No upcoming duties scheduled.</div>
             ) : groupedRoster.map((g, i) => (
               <div key={`${g.pair_id}_${g.shift}`} style={{ 
                 padding: 16, borderRadius: 16, border: `1px solid ${g.shift === 'Day' ? COLORS.sky + '30' : COLORS.gold + '30'}`,
                 background: g.shift === 'Day' ? '#fff' : COLORS.paper, display: "flex", flexDirection: "column", gap: 12
               }}>
                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: g.shift === 'Day' ? COLORS.sky : COLORS.gold, textTransform: "uppercase", marginBottom: 4 }}>
                        {g.shift} SHIFT
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.forest }}>
                        {new Date(g.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(g.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ fontSize: 24 }}>{g.shift === 'Day' ? '☀️' : '🌙'}</div>
                 </div>

                 <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Assigned Teachers</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {g.teachers.map((t: any) => (
                        <div key={t.id} style={{ background: "#fff", padding: "6px 12px", borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.charcoal }}>{t.name}</div>
                          <div style={{ fontSize: 10, color: COLORS.muted }}>{t.code}</div>
                        </div>
                      ))}
                    </div>
                 </div>

                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 12 }}>
                   {g.start_time && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.forest, background: COLORS.paper, padding: "4px 8px", borderRadius: 6 }}>
                        🕒 {g.start_time} - {g.end_time}
                      </div>
                    )}
                    {role === "admin" && (
                      <span style={{ fontSize: 11, color: COLORS.muted }}>Grouped</span>
                    )}
                 </div>
               </div>
             ))}
           </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid #F3F4F6`, textAlign: "left" }}>
                    <th style={{ padding: 12, fontSize: 12, color: COLORS.muted }}>DATE INTERVAL</th>
                    <th style={{ padding: 12, fontSize: 12, color: COLORS.muted }}>SHIFT</th>
                    <th style={{ padding: 12, fontSize: 12, color: COLORS.muted }}>TEACHERS</th>
                    <th style={{ padding: 12, fontSize: 12, color: COLORS.muted }}>TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedRoster.map((g, i) => (
                    <tr key={`${g.pair_id}_${g.shift}`} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: 12, fontSize: 13, fontWeight: 700, color: COLORS.forest }}>
                        {new Date(g.startDate).toLocaleDateString()} - {new Date(g.endDate).toLocaleDateString()}
                      </td>
                      <td style={{ padding: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: g.shift === 'Day' ? COLORS.sky : COLORS.gold, background: g.shift === 'Day' ? COLORS.paper : "#FFFBEB", padding: "4px 8px", borderRadius: 6, textTransform: "uppercase" }}>{g.shift}</span>
                      </td>
                      <td style={{ padding: 12 }}>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {g.teachers.map((t: any) => (
                            <div key={t.id}>
                              <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                              <div style={{ fontSize: 11, color: COLORS.muted }}>{t.code}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: 12, fontSize: 12, fontWeight: 600 }}>{g.start_time ? `${g.start_time} - ${g.end_time}` : "—"}</td>
                      {role === "admin" && (
                        <td style={{ padding: 12, textAlign: "right" }}>
                           <span style={{ fontSize: 11, color: COLORS.muted }}>Grouped</span>
                        </td>
                      )}
                    </tr>
                  ))}
                  {groupedRoster.length === 0 && (
                     <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>No upcoming duties scheduled.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 8
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14
};
