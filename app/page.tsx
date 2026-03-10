"use client";

import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/constants";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth, SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";

// Pages
import { LoginPage } from "@/components/pages/LoginPage";
import { DashboardPage } from "@/components/pages/DashboardPage";
import { StudentsPage } from "@/components/pages/StudentsPage";
import { ResultsPage } from "@/components/pages/ResultsPage";
import { TimetablePage } from "@/components/pages/TimetablePage";
import { AccountsPage } from "@/components/pages/AccountsPage";
import { DeanPage } from "@/components/pages/DeanPage";
import { DepartmentsPage } from "@/components/pages/DepartmentsPage";
import { ChatPage } from "@/components/pages/ChatPage";
import { StaffPage } from "@/components/pages/StaffPage";
import { ClassesPage } from "@/components/pages/ClassesPage";
import { DutyPage } from "@/components/pages/DutyPage";
import { StudentDetailPage } from "@/components/pages/StudentDetailPage";
import { GlobalAnnouncements } from "@/components/ui/GlobalAnnouncements";
import { createClient } from "@/utils/supabase/client";

type UserType = {
  role: string;
  code: string;
  name: string;
};

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schoolSettings, setSchoolSettings] = useState<any>(null);

  const supabase = createClient();
  const { isLoaded, isSignedIn } = useAuth();

  const fetchSettings = React.useCallback(async () => {
    const { data } = await supabase.from('school_settings').select('*').eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle();
    if (data) setSchoolSettings(data);
  }, [supabase]);

  const refreshSettings = React.useCallback(async () => {
    const { data } = await supabase.from('school_settings').select('*').eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle();
    if (data) setSchoolSettings(data);
  }, [supabase]);

  useEffect(() => {
    // Check session or at least wait for initial load
    const checkUser = async () => {
      const savedUser = localStorage.getItem("school_user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setLoading(false);
    };
    checkUser();

    fetchSettings();

    // Listen for school settings updates (Insert, Update, Delete)
    const channel = supabase.channel('school_settings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_settings' }, 
          (payload) => {
            if (payload.new) setSchoolSettings(payload.new);
          }
      )
      .subscribe();

    const go = () => setOffline(!navigator.onLine);
    window.addEventListener("online", go);
    window.addEventListener("offline", go);
      return () => { 
        window.removeEventListener("online", go); 
        window.removeEventListener("offline", go);
        supabase.removeChannel(channel);
      };
    }, [fetchSettings, supabase]);

  // Sync Clerk logout with school system session
  useEffect(() => {
    if (isLoaded && !isSignedIn && user) {
      handleSignOut();
    }
  }, [isLoaded, isSignedIn, user]);

  const handleLogin = async (role: string, code: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("code", code)
        .eq("role", role)
        .eq("status", "active")
        .maybeSingle();

      if (error) return error.message;
      if (!data) return "Invalid login code or role. Please try again.";

      const newUser = {
        role: data.role,
        code: data.code,
        name: data.full_name
      };

      setUser(newUser);
      localStorage.setItem("school_user", JSON.stringify(newUser));
      return null;
    } catch (err: any) {
      return err.message;
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("school_user");
    setUser(null);
    setActivePage("dashboard");
  };

  useEffect(() => {
    if (!loading && isLoaded && !user && !isSignedIn) {
      redirect("/sign-in");
    }
  }, [loading, isLoaded, user, isSignedIn]);

  if (loading || !isLoaded) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        background: COLORS.paper, 
        color: COLORS.forest, 
        fontWeight: 700 
      }}>
        Kenya School SMS...
      </div>
    );
  }

  if (!user) {
    // If not signed in, the useEffect above will trigger a redirect.
    // Return null while redirecting to avoid flashing content or errors.
    if (!isSignedIn) return null;
    
    return <LoginPage onLogin={handleLogin} />;
  }

  // No !user check here - we always have a user in Open Access mode

  interface NavItem {
    id: string;
    label: string;
    icon: string;
    show?: string[];
    hide?: string[];
  }

  const allNavItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "staff", label: "Staff Management", icon: "dept", show: ["admin", "principal", "deputy"] },
    { id: "duty", label: "Duty Roster", icon: "calendar", show: ["admin", "teacher", "principal", "deputy", "dean"] },
    { id: "classes", label: "Classes", icon: "users", show: ["admin", "teacher", "dean", "principal", "deputy"] },
    { id: "students", label: "Students", icon: "users", show: ["admin", "teacher", "dean", "principal", "deputy"] },
    { id: "results", label: "Results", icon: "chart", show: ["admin", "teacher", "dean", "principal", "deputy"] },
    { id: "dean", label: "Academic Workflow", icon: "book", show: ["admin", "dean", "principal", "deputy"] },
    { id: "timetable", label: "Timetable", icon: "calendar" },
    { id: "accounts", label: "Accounts", icon: "money", show: ["admin", "accounts"] },
    { id: "departments", label: "Departments", icon: "dept" },
    { id: "chat", label: "Leadership Chat", icon: "chat", show: ["admin", "principal", "deputy", "dean"] },
  ];

  const navItems = allNavItems.filter(n => {
    if (n.hide && n.hide.includes(user.role)) return false;
    if (n.show && !n.show.includes(user.role)) return false;
    return true;
  });

  const roleColors: Record<string, string> = { 
    admin: COLORS.forest, 
    principal: COLORS.gold, 
    deputy: COLORS.sky, 
    dean: "#059669", 
    teacher: "#7C3AED", 
    accounts: "#EA580C", 
    staff: "#4B5563", 
    student: "#10B981" 
  };
  const roleColor = roleColors[user.role] || COLORS.forest;

  const activeLabel = navItems.find(n => n.id === activePage)?.label || "Dashboard";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: COLORS.paper, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <Sidebar 
          navItems={navItems} 
          activePage={activePage} 
          setActivePage={setActivePage} 
          user={user} 
          roleColor={roleColor} 
          setUser={handleSignOut} 
          schoolLogo={schoolSettings?.school_logo_url}
          schoolName={schoolSettings?.school_name}
          isCollapsed={sidebarCollapsed}
        />

        {/* Main content */}
        <div style={{ marginLeft: sidebarCollapsed ? 70 : 240, flex: 1, display: "flex", flexDirection: "column", transition: "margin-left 0.3s ease" }}>
          <Topbar 
            activeLabel={activeLabel}
            offline={offline}
            user={user}
            roleColor={roleColor}
            isSidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
          />

          {/* Page content */}
          <div style={{ padding: 28, flex: 1 }}>
            {activePage === "dashboard" && (
              <DashboardPage 
                role={user.role} 
                onSelectStudent={(id, adm) => { setSelectedStudentId(id); setActivePage("student-detail"); }} 
                onSettingsUpdate={refreshSettings}
                selectedYear={selectedYear}
              />
            )}
            {activePage === "students" && (
              <StudentsPage 
                role={user.role} 
                code={user.code} 
                selectedYear={selectedYear} 
                onSelectStudent={(id, adm) => { 
                  setSelectedStudentId(id); 
                  setActivePage("student-detail"); 
                }}
              />
            )}
            {activePage === "results" && (
              <ResultsPage 
                role={user.role} 
                code={user.code} 
                schoolSettings={schoolSettings} 
                selectedYear={selectedYear} 
              />
            )}
            {activePage === "timetable" && <TimetablePage schoolSettings={schoolSettings} selectedYear={selectedYear} />}
            {activePage === "accounts" && <AccountsPage role={user.role} selectedYear={selectedYear} />}
            {activePage === "dean" && <DeanPage role={user.role} code={user.code} selectedYear={selectedYear} />}
            {activePage === "departments" && <DepartmentsPage role={user.role} selectedYear={selectedYear} />}
            {activePage === "staff" && <StaffPage role={user.role} selectedYear={selectedYear} />}
            {activePage === "classes" && <ClassesPage role={user.role} selectedYear={selectedYear} />}
            {activePage === "duty" && <DutyPage role={user.role} selectedYear={selectedYear} />}
            {activePage === "chat" && <ChatPage role={user.role} selectedYear={selectedYear} />}
            {activePage === "student-detail" && selectedStudentId && (
              <StudentDetailPage 
                studentId={selectedStudentId} 
                onBack={() => setActivePage("students")} 
                schoolSettings={schoolSettings}
                selectedYear={selectedYear}
              />
            )}
          </div>
        </div>
        
        {/* Global floating components */}
      <GlobalAnnouncements role={user.role} />
    </div>
  );
}
