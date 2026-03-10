"use client";

import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/constants";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/utils/supabase/client";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

export const AccountsPage = ({ role, selectedYear }: { role: string, selectedYear: string }) => {
  const CURRENT_TERM = "Term 2, 2025";
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState("overview"); // overview, transactions, fees, reports, settings
  const [loading, setLoading] = useState(true);
  
  // Dashboard & Transactions State
  const [transactions, setTransactions] = useState<any[]>([]);
  const [finStats, setFinStats] = useState({ totalIncome: 0, totalExpense: 0, netBalance: 0 });
  const [documents, setDocuments] = useState<any[]>([]);
  
  // Document Upload State
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("Receipt");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Add Transaction State
  const [trxType, setTrxType] = useState("income");
  const [trxCategory, setTrxCategory] = useState("Tuition Fee");
  const [trxTitle, setTrxTitle] = useState("");
  const [trxAmount, setTrxAmount] = useState("");
  const [trxReceipt, setTrxReceipt] = useState("");
  const [trxDate, setTrxDate] = useState("");

  // Existing Fee State
  const [stats, setStats] = useState({ expected: 0, paid: 0, balance: 0, defaultersCount: 0 });
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [editingFees, setEditingFees] = useState<Record<string, string>>({ "1": "", "2": "", "3": "", "4": "" });

  // Fee Form State
  const [adm, setAdm] = useState("");
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState("");
  const [date, setDate] = useState("");

  const detectLevel = (cls: any) => {
    if (!cls) return "";
    return String(cls.level || cls.name?.charAt(0) || "");
  };

  const formatMoney = (amount: number) => {
    if (amount === 0) return "KSh 0";
    if (amount >= 1000000) return `KSh ${(amount / 1e6).toFixed(2)}M`;
    return `KSh ${amount.toLocaleString()}`;
  };

  const fetchAccounts = async () => {
    setLoading(true);
    const termStr = `Term 2, ${selectedYear}`;
    const { data: allSts } = await supabase.from('students').select('id, profile_id, class_id, profiles:profile_id(full_name, code), classes:class_id(level, name)');
    const { data: feeRecords } = await supabase.from('fees').select('*').eq('term', termStr);
    const { data: lFees } = await supabase.from('level_fees').select('*').eq('term', termStr);

    if (allSts) {
      const feeLookup = (lFees || []).reduce((acc, lf) => ({ ...acc, [lf.level]: Number(lf.amount) }), {} as Record<string, number>);
      const studentFeeLookup = (feeRecords || []).reduce((acc, f) => ({ ...acc, [f.student_id]: f }), {} as Record<string, any>);
      
      setEditingFees(prev => {
        const next = { ...prev };
        (lFees || []).forEach(lf => {
          if (!next[lf.level]) next[lf.level] = lf.amount.toString();
        });
        return next;
      });

      let tExp = 0, tPaid = 0, defC = 0, dL: any[] = [];
      allSts.forEach((s: any) => {
        const feeRec = studentFeeLookup[s.id];
        const lvl = detectLevel(s.classes);
        const expected = feeRec ? Number(feeRec.expected_amount) : (feeLookup[lvl] || 0);
        const paid = feeRec ? Number(feeRec.paid_amount) : 0;
        const bal = expected - paid;
        tExp += expected; tPaid += paid;
        if (bal > 0 && s.profiles) {
          defC++;
          dL.push({ adm: s.profiles.code, name: s.profiles.full_name, class: s.classes?.name || "N/A", expected, paid, balance: bal, lastDate: feeRec?.last_payment_date });
        }
      });
      setStats({ expected: tExp, paid: tPaid, balance: tExp - tPaid, defaultersCount: defC });
      setDefaulters(dL);
    }

    // New: Fetch Transactions
    const { data: trxData } = await supabase.from('transactions').select('*').order('date', { ascending: false });
    if (trxData) {
      setTransactions(trxData);
      let tInc = 0, tExp = 0;
      trxData.forEach(t => {
        if (t.type === 'income') tInc += Number(t.amount);
        else tExp += Number(t.amount);
      });
      setFinStats({ totalIncome: tInc, totalExpense: tExp, netBalance: tInc - tExp });
    }

    // New: Fetch Documents
    const { data: docData } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (docData) setDocuments(docData);

    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, [selectedYear]);

  const handleRecordPayment = async () => {
    if (!adm || !amount) return alert("Enter ADM and Amount.");
    setLoading(true);
    const { data: prof } = await supabase.from('profiles').select('id, full_name').eq('code', adm).single();
    if (!prof) { setLoading(false); return alert("Student not found!"); }
    const { data: st } = await supabase.from('students').select('id, class_id, classes:class_id(level, name)').eq('profile_id', prof.id).single();
    if (!st) { setLoading(false); return alert("Not a registered student!"); }

    const { data: existing } = await supabase.from('fees').select('id, paid_amount').eq('student_id', st.id).eq('term', CURRENT_TERM).single();

    if (existing) {
      await supabase.from('fees').update({ 
        paid_amount: Number(existing.paid_amount) + Number(amount),
        last_payment_date: date || new Date().toISOString().split('T')[0],
        receipt_no: receipt
      }).eq('id', existing.id);
    } else {
      const lvl = detectLevel(st.classes);
      const { data: lf } = await supabase.from('level_fees').select('amount').eq('level', lvl).eq('term', CURRENT_TERM).maybeSingle();
      await supabase.from('fees').insert({
        student_id: st.id, term: CURRENT_TERM, expected_amount: lf?.amount || 0,
        paid_amount: Number(amount), last_payment_date: date || new Date().toISOString().split('T')[0], receipt_no: receipt
      });
    }

    // Auto-sync: Create Income Transaction for the fee payment
    await supabase.from('transactions').insert({
      type: 'income',
      category: 'Tuition Fee',
      title: `Fee Payment - ${prof.full_name} (${adm})`,
      amount: Number(amount),
      receipt_no: receipt,
      student_id: st.id,
      date: date || new Date().toISOString().split('T')[0]
    });

    alert("Payment recorded successfully.");
    setAdm(""); setAmount(""); setReceipt(""); setDate(""); await fetchAccounts();
  };

  const handleUpdateLevelFee = async (lvl: string) => {
    const amt = editingFees[lvl];
    if (!amt) return alert("Enter amount.");
    const { error } = await supabase.from('level_fees').upsert(
      { level: lvl, term: CURRENT_TERM, amount: Number(amt) },
      { onConflict: 'level,term' }   // ← no space
    );
    if (error) return alert("Error saving: " + error.message);
    alert(`Fee for Form ${lvl} updated.`);
    await fetchAccounts();
  };

  const handleSyncLevelFees = async (lvl: string) => {
    const amt = Number(editingFees[lvl]);
    if (!amt || !confirm(`Update ALL Form ${lvl} students to KSh ${amt.toLocaleString()}?`)) return;
    setLoading(true);

    // 1. Persist the level fee
    await supabase.from('level_fees').upsert(
      { level: lvl, term: CURRENT_TERM, amount: amt },
      { onConflict: 'level,term' }
    );

    // 2. Find matching classes — very permissive filter
    const { data: cls, error: clsErr } = await supabase.from('classes').select('id, name, level');
    console.log("[Sync] All classes:", cls, "Error:", clsErr);

    const targetIds = (cls || []).filter(c => {
      const lvlStr = String(c.level ?? "").trim();
      const nameStr = String(c.name ?? "").trim();
      return (
        lvlStr === lvl ||                           // exact match: "1" === "1"
        lvlStr === `Form ${lvl}` ||                 // "Form 1" match
        lvlStr.startsWith(lvl) ||                   // "1A" starts with "1"
        nameStr.startsWith(lvl) ||                  // class name "1W" starts with "1"
        nameStr.toLowerCase().startsWith(`form ${lvl}`)  // "form 1a" match
      );
    }).map(c => c.id);

    console.log(`[Sync] Form ${lvl} matched class IDs:`, targetIds);

    if (targetIds.length === 0) {
      const allLevels = (cls || []).map(c => `${c.name}(level=${c.level})`).join(", ");
      alert(`No classes found for Form ${lvl}.\n\nClasses in DB: ${allLevels || "none"}`);
      setLoading(false); return;
    }

    // 3. Get students in those classes
    const { data: sts } = await supabase.from('students').select('id').in('class_id', targetIds);

    if (!sts || sts.length === 0) { alert("No students found in this level."); setLoading(false); return; }

    // 4. Upsert fee records
    const { error } = await supabase.from('fees').upsert(
      sts.map(s => ({ student_id: s.id, term: CURRENT_TERM, expected_amount: amt })),
      { onConflict: 'student_id,term' }
    );

    if (error) { alert("Sync failed: " + error.message); setLoading(false); return; }

    alert(`✅ Synced ${sts.length} students in Form ${lvl} to KSh ${amt.toLocaleString()}.`);
    await fetchAccounts();
  };

  const handleRecordTransaction = async () => {
    if (!trxTitle || !trxAmount) return alert("Title and Amount are required.");
    setLoading(true);
    const { error } = await supabase.from('transactions').insert({
      type: trxType,
      category: trxCategory,
      title: trxTitle,
      amount: Number(trxAmount),
      receipt_no: trxReceipt,
      date: trxDate || new Date().toISOString().split('T')[0]
    });
    if (error) alert("Error saving transaction: " + error.message);
    else {
      alert("Transaction successfully recorded.");
      setTrxTitle(""); setTrxAmount(""); setTrxReceipt(""); setTrxDate("");
      await fetchAccounts();
    }
    setLoading(false);
  };

  const handleUploadDocument = async () => {
    if (!docTitle || !docFile) return alert("Please provide a title and select a file.");
    setUploadingDoc(true);

    try {
      const fileExt = docFile.name.split('.').pop() || 'pdf';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `vault/${fileName}`;

      const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, docFile, {
         cacheControl: '3600',
         upsert: false
      });
      
      if (uploadErr) {
        setUploadingDoc(false);
        return alert("Failed to upload file to storage bucket. " + uploadErr.message);
      }

      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(filePath);

      const { error: dbErr } = await supabase.from('documents').insert({
        title: docTitle,
        document_type: docType,
        file_url: publicUrlData.publicUrl
      });

      if (dbErr) {
        alert("Error saving document record: " + dbErr.message);
      } else {
        alert("Document securely uploaded and saved!");
        setDocTitle("");
        setDocFile(null);
        await fetchAccounts();
      }
    } catch (e: any) {
      alert("An unexpected error occurred: " + e.message);
    }
    setUploadingDoc(false);
  };

  const handleDeleteDocument = async (docId: string, fileUrl: string) => {
    if (!confirm("Are you sure you want to delete this document permanently?")) return;
    setLoading(true);
    
    // Extract file path from URL (last part after /documents/)
    const filePath = fileUrl.split('/documents/').pop();
    if (filePath) {
      await supabase.storage.from('documents').remove([filePath]);
    }
    
    await supabase.from('documents').delete().eq('id', docId);
    await fetchAccounts();
    setLoading(false);
    alert("Document deleted successfully.");
  };

  const handleExportLedgerCSV = () => {
    const headers = ["Date", "Description", "Category", "Receipt No", "Type", "Amount"];
    const rows = transactions.map(t => [t.date, t.title, t.category, t.receipt_no || "", t.type, t.amount]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `ledger_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportDefaultersCSV = () => {
    const headers = ["ADM", "Name", "Class", "Expected", "Paid", "Balance"];
    const rows = defaulters.map(d => [d.adm, d.name, d.class, d.expected, d.paid, d.balance]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `defaulters_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs = [
    { id: "overview", label: "Dashboard Overview" },
    { id: "transactions", label: "Ledger / Transactions" },
    { id: "fees", label: "Student Fees Control" },
    { id: "reports", label: "Financial Reports" }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          nav, aside, header { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; overflow: visible !important; }
          .print-break { page-break-before: always; }
          @page { margin: 1.5cm; }
        }
      `}</style>
      
      {/* Top Navigation Tabs */}
      <div className="no-print" style={{ display: "flex", gap: 8, background: COLORS.paper, padding: "6px", borderRadius: 12, border: "1px solid #E5E7EB", overflowX: "auto" }}>
        {tabs.map(t => (
          <button 
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{ 
              padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, 
              border: "none", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s",
              background: activeTab === t.id ? COLORS.forest : "transparent",
              color: activeTab === t.id ? "#fff" : COLORS.muted,
              boxShadow: activeTab === t.id ? "0 4px 12px rgba(0,0,0,0.15)" : "none"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Macro Financial Overview */}
          <SectionHeader title="📈 Master Financial Overview" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div style={{ background: "#F0FDF4", padding: 24, borderRadius: 16, border: "1px solid #BBF7D0", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Income</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#16A34A" }}>{formatMoney(finStats.totalIncome)}</div>
              <div style={{ fontSize: 12, color: "#15803D", fontWeight: 600 }}>Fees & Other Revenue</div>
            </div>
            <div style={{ background: "#FEF2F2", padding: 24, borderRadius: 16, border: "1px solid #FECACA", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Expenses</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: COLORS.red }}>{formatMoney(finStats.totalExpense)}</div>
              <div style={{ fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>Salaries & Purchases</div>
            </div>
            <div style={{ background: finStats.netBalance >= 0 ? "#F0F9FF" : "#FEF2F2", padding: 24, borderRadius: 16, border: `1px solid ${finStats.netBalance >= 0 ? "#BAE6FD" : "#FECACA"}`, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: finStats.netBalance >= 0 ? "#0369A1" : "#991B1B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Net Balance</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: finStats.netBalance >= 0 ? COLORS.sky : COLORS.red }}>{formatMoney(Math.abs(finStats.netBalance))}</div>
              <div style={{ fontSize: 12, color: finStats.netBalance >= 0 ? "#0284C7" : "#B91C1C", fontWeight: 600 }}>{finStats.netBalance >= 0 ? 'Surplus' : 'Deficit'}</div>
            </div>
            <div style={{ background: "#FFFBEB", padding: 24, borderRadius: 16, border: "1px solid #FDE68A", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.05em" }}>Outstanding Fees</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#D97706" }}>{formatMoney(stats.balance)}</div>
              <div style={{ fontSize: 12, color: "#B45309", fontWeight: 600 }}>From {stats.defaultersCount} students</div>
            </div>
          </div>

          {/* Visual Analytics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
             <div style={{ background: "#fff", padding: 24, borderRadius: 16, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                <SectionHeader title="📊 Cash Flow Trends" />
                <div style={{ height: 300, marginTop: 16 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Income', value: finStats.totalIncome },
                      { name: 'Expense', value: finStats.totalExpense },
                      { name: 'Arrears', value: stats.balance }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={12} fontWeight={700} />
                      <YAxis fontSize={11} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: "none" }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50}>
                        <Cell fill="#16A34A" />
                        <Cell fill={COLORS.red} />
                        <Cell fill="#D97706" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             </div>
             <div style={{ background: "#fff", padding: 24, borderRadius: 16, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                <SectionHeader title="🍰 Expense Categories" />
                <div style={{ height: 300, marginTop: 16 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(() => {
                          const cats: Record<string, number> = {};
                          transactions.filter(t => t.type === 'expense').forEach(t => {
                            cats[t.category] = (cats[t.category] || 0) + Number(t.amount);
                          });
                          return Object.entries(cats).map(([name, value]) => ({ name, value }));
                        })()}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                      >
                        {["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6"].map((color, index) => (
                           <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
             </div>
          </div>

          {/* Recent Transactions Feed */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
            <SectionHeader title="🧾 Recent Ledger Activity" action={{ label: "View All", fn: () => setActiveTab("transactions") }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {transactions.slice(0, 5).length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>No recent transactions recorded.</div>
              ) : transactions.slice(0, 5).map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: t.type === 'income' ? "#F0FDF4" : "#FEF2F2", borderLeft: `4px solid ${t.type === 'income' ? "#22C55E" : COLORS.red}` }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                       <span style={{ fontWeight: 800, fontSize: 14, color: COLORS.charcoal }}>{t.title}</span>
                       <Badge type={t.type === 'income' ? 'success' : 'danger'}>{t.category}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>{new Date(t.date).toLocaleDateString()} • {t.receipt_no || 'No Receipt'}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: t.type === 'income' ? "#16A34A" : COLORS.red }}>
                    {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: TRANSACTIONS PORTAL */}
      {activeTab === "transactions" && (
        <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", borderTop: `4px solid ${trxType === 'income' ? "#22C55E" : COLORS.red}` }}>
            <SectionHeader title="💸 Post New Transaction" />
            <div style={{ display: "flex", gap: 12, marginBottom: 20, marginTop: 10 }}>
               <button onClick={()=>setTrxType("income")} style={{ flex: 1, padding: "12px", borderRadius: 10, fontWeight: 800, fontSize: 14, border: `2px solid ${trxType === 'income' ? '#22C55E' : '#E5E7EB'}`, background: trxType === 'income' ? '#F0FDF4' : '#fff', color: trxType === 'income' ? '#166534' : COLORS.muted, cursor: "pointer" }}>INCOME</button>
               <button onClick={()=>setTrxType("expense")} style={{ flex: 1, padding: "12px", borderRadius: 10, fontWeight: 800, fontSize: 14, border: `2px solid ${trxType === 'expense' ? COLORS.red : '#E5E7EB'}`, background: trxType === 'expense' ? '#FEF2F2' : '#fff', color: trxType === 'expense' ? '#991B1B' : COLORS.muted, cursor: "pointer" }}>EXPENSE</button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Category</label>
                <select value={trxCategory} onChange={e=>setTrxCategory(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14, background: "#fff" }}>
                  {trxType === 'income' ? (
                     <><option>Tuition Fee</option><option>Transport</option><option>Events</option><option>Other Income</option></>
                  ) : (
                     <><option>Salary</option><option>Stationery</option><option>Maintenance</option><option>Utilities</option><option>Other Expense</option></>
                  )}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Description / Title</label>
                <input value={trxTitle} onChange={e=>setTrxTitle(e.target.value)} type="text" placeholder="e.g. November Staff Salaries" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Amount (KSh)</label>
                <input value={trxAmount} onChange={e=>setTrxAmount(e.target.value)} type="number" placeholder="50000" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Receipt / Invoice No.</label>
                <input value={trxReceipt} onChange={e=>setTrxReceipt(e.target.value)} type="text" placeholder="INV-202" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Date</label>
                <input value={trxDate} onChange={e=>setTrxDate(e.target.value)} type="date" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }} />
              </div>
            </div>
            
            <button onClick={handleRecordTransaction} style={{ marginTop: 24, width: "100%", background: trxType === 'income' ? '#16A34A' : COLORS.red, color: "#fff", border: "none", borderRadius: 12, padding: "16px", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
              Record {trxType.toUpperCase()}
            </button>
          </div>

          {/* Full Ledger Table */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
             <SectionHeader title="📒 Complete Activity Ledger" />
             <button onClick={handleExportLedgerCSV} style={{ background: COLORS.paper, color: COLORS.forest, border: `1px solid ${COLORS.forest}40`, borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="download" size={14} color={COLORS.forest} /> Export Ledger CSV
             </button>
          </div>
          <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
             <table style={{ width: "100%", borderCollapse: "collapse" }}>
               <thead>
                 <tr style={{ background: COLORS.cream }}>
                   {["Date", "Description", "Category", "Receipt No", "Income", "Expense"].map(h => <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase" }}>{h}</th>)}
                 </tr>
               </thead>
               <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "14px 16px", fontSize: 12, color: COLORS.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{new Date(t.date).toLocaleDateString()}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 13, color: COLORS.charcoal }}>{t.title}</td>
                      <td style={{ padding: "14px 16px" }}><Badge type={t.type === 'income' ? 'success' : 'danger'}>{t.category}</Badge></td>
                      <td style={{ padding: "14px 16px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{t.receipt_no || '-'}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 800, color: "#16A34A", background: "#F0FDF4" }}>{t.type === 'income' ? formatMoney(t.amount) : '-'}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 800, color: COLORS.red, background: "#FEF2F2" }}>{t.type === 'expense' ? formatMoney(t.amount) : '-'}</td>
                    </tr>
                  ))}
               </tbody>
             </table>
          </div>
        </div>
      )}

      {/* TAB: STUDENT FEES CONTROL */}
      {activeTab === "fees" && (
        <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {["accounts", "admin", "principal", "deputy"].includes(role) && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
              <SectionHeader title="💳 Log Direct Tuition Payment" />
              <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>* Payments logged here auto-generate Income entries on the Master Ledger.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Student ADM</label>
                  <input value={adm} onChange={e=>setAdm(e.target.value)} type="text" placeholder="ADM001" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Amount Paid (KSh)</label>
                  <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" placeholder="25000" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Receipt Number</label>
                  <input value={receipt} onChange={e=>setReceipt(e.target.value)} type="text" placeholder="R-101" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Payment Date</label>
                  <input value={date} onChange={e=>setDate(e.target.value)} type="date" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }} />
                </div>
              </div>
              <button onClick={handleRecordPayment} style={{ marginTop: 24, background: COLORS.forest, color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontWeight: 700, cursor: "pointer" }}>Record Student Payment</button>
            </div>
          )}

          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <SectionHeader title="📋 Outstanding Balances (Defaulters List)" />
              <button onClick={handleExportDefaultersCSV} style={{ background: COLORS.paper, color: COLORS.red, border: `1px solid ${COLORS.red}40`, borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="download" size={14} color={COLORS.red} /> Export Defaulters CSV
              </button>
            </div>
            <div style={{ overflowX: "auto", marginTop: 16 }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                <thead>
                  <tr style={{ background: "#FEF2F2" }}>
                    {["Student", "ADM", "Class", "Expected", "Paid", "Balance"].map(h => (
                      <th key={h} style={{ padding: "14px", textAlign: "left", fontSize: 12, fontWeight: 800, color: COLORS.red, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: COLORS.muted }}>Refreshing financial data...</td></tr>
                  ) : defaulters.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: COLORS.muted }}>Great! No students have unpaid fees.</td></tr>
                  ) : defaulters.map((s) => (
                    <tr key={s.adm} style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                      <td style={{ padding: "14px", fontWeight: 600 }}>{s.name}</td>
                      <td style={{ padding: "14px", color: COLORS.forest, fontFamily: "monospace", fontSize: 14 }}>{s.adm}</td>
                      <td style={{ padding: "14px" }}><Badge type="info">{s.class}</Badge></td>
                      <td style={{ padding: "14px" }}>{formatMoney(s.expected)}</td>
                      <td style={{ padding: "14px", color: "#16a34a" }}>{formatMoney(s.paid)}</td>
                      <td style={{ padding: "14px", fontWeight: 800, color: s.balance > 20000 ? COLORS.red : "#d97706" }}>{formatMoney(s.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {["accounts", "admin"].includes(role) && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
              <SectionHeader title="⚙️ Fee Structure Settings" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginTop: 16 }}>
                {["1", "2", "3", "4"].map(lvl => (
                  <div key={lvl} style={{ background: "#F9FAFB", padding: 20, borderRadius: 14, border: "1px solid #E5E7EB" }}>
                    <div style={{ fontWeight: 800, marginBottom: 14, fontSize: 15 }}>Form {lvl} Fee</div>
                    <input type="number" value={editingFees[lvl]} onChange={e => setEditingFees({...editingFees, [lvl]: e.target.value})} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #E5E7EB", marginBottom: 16, fontSize: 14 }} />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => handleUpdateLevelFee(lvl)} style={{ flex: 1, background: COLORS.forest, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                      <button onClick={() => handleSyncLevelFees(lvl)} style={{ flex: 1, background: COLORS.gold, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Sync All</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: REPORTS AND DOCUMENTS */}
      {activeTab === "reports" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Printable Report Header Actions */}
          <div className="no-print" style={{ background: "#fff", borderRadius: 16, padding: 24, display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: `4px solid ${COLORS.gold}`, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
             <div>
               <h3 style={{ margin: 0, color: COLORS.charcoal, fontSize: 18, marginBottom: 8 }}>Print Master Financial Report</h3>
               <p style={{ margin: 0, color: COLORS.muted, fontSize: 13 }}>Generates a comprehensive PDF breakdown of all accounts, ledgers, and outstanding debts.</p>
             </div>
             <button onClick={() => window.print()} style={{ background: COLORS.charcoal, color: "#fff", padding: "14px 24px", borderRadius: 12, border: "none", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
               🖨️ Print PDF Report
             </button>
          </div>

          {/* Actual Report Views (Included in Print) */}
          <div className="printable-report" style={{ background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
               <h1 style={{ fontSize: 24, margin: 0, color: COLORS.charcoal }}>KENYA HIGH SCHOOL</h1>
               <h2 style={{ fontSize: 18, margin: "8px 0 0 0", color: COLORS.muted }}>Master Financial Report</h2>
               <p style={{ margin: "4px 0 0 0", fontSize: 12, color: COLORS.muted }}>Generated on {new Date().toLocaleDateString()}</p>
            </div>
            
            <h3 style={{ borderBottom: "2px solid #E5E7EB", paddingBottom: 8, marginBottom: 16, color: COLORS.charcoal, fontSize: 16 }}>Financial Overview</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 32 }}>
              <div style={{ padding: 16, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8 }}>
                 <div style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>Total Income</div>
                 <div style={{ fontSize: 24, fontWeight: 900, color: "#16A34A" }}>{formatMoney(finStats.totalIncome)}</div>
              </div>
              <div style={{ padding: 16, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}>
                 <div style={{ fontSize: 12, fontWeight: 700, color: "#991B1B" }}>Total Expenses</div>
                 <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.red }}>{formatMoney(finStats.totalExpense)}</div>
              </div>
              <div style={{ padding: 16, background: finStats.netBalance >= 0 ? "#F0F9FF" : "#FFF1F2", border: `1px solid ${finStats.netBalance >= 0 ? "#BAE6FD" : "#FECDD3"}`, borderRadius: 8 }}>
                 <div style={{ fontSize: 12, fontWeight: 700, color: finStats.netBalance >= 0 ? "#0369A1" : "#9F1239" }}>Net Balance</div>
                 <div style={{ fontSize: 24, fontWeight: 900, color: finStats.netBalance >= 0 ? COLORS.sky : COLORS.red }}>{formatMoney(Math.abs(finStats.netBalance))}</div>
              </div>
            </div>

            <h3 style={{ borderBottom: "2px solid #E5E7EB", paddingBottom: 8, marginBottom: 16, color: COLORS.charcoal, fontSize: 16 }}>Ledger Summary (Completed Transactions)</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
              <thead>
                <tr style={{ background: COLORS.cream }}>
                  <th style={{ padding: "10px", textAlign: "left", fontSize: 12, color: COLORS.muted }}>Date</th>
                  <th style={{ padding: "10px", textAlign: "left", fontSize: 12, color: COLORS.muted }}>Description</th>
                  <th style={{ padding: "10px", textAlign: "left", fontSize: 12, color: COLORS.muted }}>Category</th>
                  <th style={{ padding: "10px", textAlign: "right", fontSize: 12, color: COLORS.muted }}>Income</th>
                  <th style={{ padding: "10px", textAlign: "right", fontSize: 12, color: COLORS.muted }}>Expense</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", fontStyle: "italic", color: COLORS.muted }}>No transactions recorded.</td></tr> : null}
                {transactions.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #E5E7EB" }}>
                    <td style={{ padding: "10px", fontSize: 12, color: COLORS.muted }}>{new Date(t.date).toLocaleDateString()}</td>
                    <td style={{ padding: "10px", fontSize: 12, fontWeight: 600, color: COLORS.charcoal }}>{t.title}</td>
                    <td style={{ padding: "10px", fontSize: 12 }}>{t.category}</td>
                    <td style={{ padding: "10px", fontSize: 12, textAlign: "right", color: "#16A34A", fontWeight: 700 }}>{t.type === 'income' ? formatMoney(t.amount) : '-'}</td>
                    <td style={{ padding: "10px", fontSize: 12, textAlign: "right", color: COLORS.red, fontWeight: 700 }}>{t.type === 'expense' ? formatMoney(t.amount) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="print-break" />

            <h3 style={{ borderBottom: "2px solid #E5E7EB", paddingBottom: 8, marginBottom: 16, color: COLORS.charcoal, fontSize: 16, marginTop: 40 }}>Outstanding Balances (Defaulters)</h3>
            <div style={{ marginBottom: 16, fontSize: 14, fontWeight: 600 }}>Total Outstanding: <span style={{ color: COLORS.red }}>{formatMoney(stats.balance)}</span></div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FEF2F2" }}>
                  <th style={{ padding: "10px", textAlign: "left", fontSize: 12, color: COLORS.red }}>Student Name</th>
                  <th style={{ padding: "10px", textAlign: "left", fontSize: 12, color: COLORS.red }}>ADM</th>
                  <th style={{ padding: "10px", textAlign: "left", fontSize: 12, color: COLORS.red }}>Class</th>
                  <th style={{ padding: "10px", textAlign: "right", fontSize: 12, color: COLORS.red }}>Expected</th>
                  <th style={{ padding: "10px", textAlign: "right", fontSize: 12, color: COLORS.red }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {defaulters.length === 0 ? <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", fontStyle: "italic", color: COLORS.muted }}>No outstanding balances detected.</td></tr> : null}
                {defaulters.map(d => (
                   <tr key={d.adm} style={{ borderBottom: "1px solid #E5E7EB" }}>
                     <td style={{ padding: "10px", fontSize: 12, fontWeight: 600, color: COLORS.charcoal }}>{d.name}</td>
                     <td style={{ padding: "10px", fontSize: 12 }}>{d.adm}</td>
                     <td style={{ padding: "10px", fontSize: 12 }}>{d.class}</td>
                     <td style={{ padding: "10px", fontSize: 12, textAlign: "right" }}>{formatMoney(d.expected)}</td>
                     <td style={{ padding: "10px", fontSize: 12, textAlign: "right", color: COLORS.red, fontWeight: 700 }}>{formatMoney(d.balance)}</td>
                   </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="no-print" style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
             <SectionHeader title="📁 Secure Document Vault" />
             <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 20 }}>Upload, store, and manage important financial documents like receipts, invoices, and bank statements.</p>
             
             {/* Upload Form */}
             {["accounts", "admin"].includes(role) && (
               <div style={{ background: COLORS.paper, padding: 20, borderRadius: 14, marginBottom: 24, border: "1px dashed #D1D5DB" }}>
                 <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Document Title</label>
                      <input value={docTitle} onChange={e=>setDocTitle(e.target.value)} type="text" placeholder="e.g. November Bank Statement" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }} />
                    </div>
                    <div style={{ width: 150 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>Type</label>
                      <select value={docType} onChange={e=>setDocType(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #E5E7EB", outline: "none", fontSize: 14 }}>
                        <option>Receipt</option>
                        <option>Invoice</option>
                        <option>Statement</option>
                        <option>Report</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>File to Upload</label>
                      <input type="file" onChange={e => setDocFile(e.target.files ? e.target.files[0] : null)} style={{ padding: "9px" }} />
                    </div>
                    <button onClick={handleUploadDocument} disabled={uploadingDoc} style={{ background: COLORS.charcoal, color: "#fff", border: "none", borderRadius: 10, padding: "13px 24px", fontWeight: 700, cursor: uploadingDoc ? "wait" : "pointer" }}>
                      {uploadingDoc ? "Uploading..." : "Upload Document"}
                    </button>
                 </div>
               </div>
             )}

             {/* Document List */}
             <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
               {documents.length === 0 ? (
                 <div style={{ padding: 32, textAlign: "center", color: COLORS.muted, fontSize: 13, background: "#F9FAFB", borderRadius: 12, gridColumn: "1 / -1", border: "1px solid #E5E7EB" }}>
                    No documents have been securely stored in the vault yet.
                 </div>
               ) : documents.map(d => (
                 <div key={d.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, background: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                   <div>
                     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                       <Badge type={d.document_type === 'Statement' ? 'danger' : 'info'}>{d.document_type}</Badge>
                       <span style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{new Date(d.created_at).toLocaleDateString()}</span>
                     </div>
                     <h4 style={{ margin: "0 0 8px 0", color: COLORS.charcoal, fontSize: 15 }}>{d.title}</h4>
                   </div>
                   <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                     <a href={d.file_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: "center", background: "#F0FDF4", color: "#166534", textDecoration: "none", padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                       Open File
                     </a>
                     {role === 'admin' && (
                       <button onClick={() => handleDeleteDocument(d.id, d.file_url)} style={{ background: "#FEF2F2", color: COLORS.red, border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                         Delete
                       </button>
                     )}
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}
      
    </div>
  );
};
