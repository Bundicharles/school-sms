-- Kenya High School SMS Database Schema
-- Run this entire script in your Supabase SQL Editor

-- 1. Create custom roles enum
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('admin', 'principal', 'deputy', 'dean', 'teacher', 'accounts', 'staff', 'student');

-- 2. Create the Profiles table 
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL, 
  code TEXT UNIQUE NOT NULL, -- ADM Number or Staff Code
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'suspended', 'archived'
  status_reason TEXT,
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create School Settings table
CREATE TABLE IF NOT EXISTS school_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name TEXT NOT NULL DEFAULT 'KENYA HIGH SCHOOL',
  school_address TEXT DEFAULT 'P.O. Box 1234 - 00100, Nairobi',
  school_phone TEXT DEFAULT '+254 700 000 000',
  school_email TEXT DEFAULT 'info@kenyahigh.ac.ke',
  school_motto TEXT DEFAULT 'Where Excellence is a Tradition',
  school_logo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create the Departments table
CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  hod_id UUID REFERENCES profiles(id), 
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create the Classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL, -- e.g "Form 1A"
  level TEXT NOT NULL,       -- e.g "1", "2", "3", "4"
  class_teacher_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Centralized Exams Configuration
CREATE TABLE IF NOT EXISTS exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL, -- e.g "Form 4 Mock Exam"
  academic_year TEXT NOT NULL, -- e.g "2026"
  term TEXT NOT NULL, -- e.g "Term 1"
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'closed')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Students table
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  class_id UUID REFERENCES classes(id),
  status TEXT DEFAULT 'active',
  status_reason TEXT,
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create Teacher_Subjects Mapping
CREATE TABLE IF NOT EXISTS teacher_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  weekly_lessons INTEGER DEFAULT 0,
  UNIQUE(teacher_id, subject_id, class_id)
);

-- 10. Create Results table
CREATE TABLE IF NOT EXISTS results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  term TEXT NOT NULL, 
  exam_type TEXT NOT NULL, 
  score INTEGER CHECK (score >= 0 AND score <= 100),
  teacher_comment TEXT,
  entered_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, term, exam_type)
);

-- 11. Create Student Files table
CREATE TABLE IF NOT EXISTS student_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE UNIQUE NOT NULL,
  parent_contact TEXT,
  emergency_contact TEXT,
  hobbies TEXT,
  cocurricular TEXT, 
  character_comments TEXT, 
  leadership_roles TEXT,
  admission_date DATE,
  leaving_date DATE,
  overall_grade TEXT,
  certificate_no TEXT UNIQUE,
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Create Fees/Accounts table
CREATE TABLE IF NOT EXISTS fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  expected_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  pocket_money_balance DECIMAL(10,2) DEFAULT 0,
  receipt_no TEXT,
  payment_mode TEXT,
  last_payment_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, term)
);

-- 13. Create Level Fees table
CREATE TABLE IF NOT EXISTS level_fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  level TEXT NOT NULL, 
  term TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(level, term)
);

-- 14. Timetable Slots table
CREATE TABLE IF NOT EXISTS timetable_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  day TEXT NOT NULL,
  period_index INTEGER NOT NULL,
  subject_name TEXT NOT NULL,
  teacher_id UUID REFERENCES profiles(id),
  teacher_name TEXT,
  start_time TEXT,
  end_time TEXT,
  is_locked BOOLEAN DEFAULT FALSE,
  UNIQUE(class_id, day, period_index)
);

-- 15. Prep and Remedial sessions
CREATE TABLE IF NOT EXISTS prep_remedial_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT CHECK (type IN ('prep', 'remedial')) NOT NULL,
  day TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Duty Roster table
CREATE TABLE IF NOT EXISTS duty_roster (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  duty_date DATE NOT NULL,
  shift TEXT CHECK (shift IN ('Day', 'Night')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, duty_date, shift)
);

-- 17. School Transactions Ledger
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
  category TEXT NOT NULL, 
  title TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  receipt_no TEXT,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL, 
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Financial Documents & Exam Papers Vault
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL, 
  file_url TEXT NOT NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'low',
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. Timetable Settings
CREATE TABLE IF NOT EXISTS timetable_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lessons_per_day INTEGER NOT NULL DEFAULT 9,
  days_per_week INTEGER NOT NULL DEFAULT 5,
  has_weekend BOOLEAN DEFAULT FALSE,
  weekend_days TEXT[] DEFAULT '{}',
  structure JSONB DEFAULT '[
    {"name": "Period 1", "type": "lesson", "startTime": "08:00", "endTime": "08:40"},
    {"name": "Period 2", "type": "lesson", "startTime": "08:40", "endTime": "09:20"},
    {"name": "Period 3", "type": "lesson", "startTime": "09:20", "endTime": "10:00"},
    {"name": "Break", "type": "break", "startTime": "10:00", "endTime": "10:20"},
    {"name": "Period 4", "type": "lesson", "startTime": "10:20", "endTime": "11:00"},
    {"name": "Period 5", "type": "lesson", "startTime": "11:00", "endTime": "11:40"},
    {"name": "Lunch", "type": "break", "startTime": "12:40", "endTime": "13:20"}
  ]',
  lesson_duration INTEGER DEFAULT 40,
  lesson_start_time TEXT DEFAULT '08:00',
  school_days TEXT[] DEFAULT '{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. Enable RLS for all tables (Security Hardening)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_remedial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_log ENABLE ROW LEVEL SECURITY;

-- 22. Baseline Security Policies (Public Read for essential info)

-- School Settings: Allow read access to everyone
DROP POLICY IF EXISTS "Public Read Settings" ON school_settings;
CREATE POLICY "Public Read Settings" ON school_settings FOR SELECT USING (true);

-- Profiles: Allow read access to everyone (required for login check)
-- NOTE: In a production environment, you should restrict this to specific columns or use service role for login.
DROP POLICY IF EXISTS "Public Read Profiles" ON profiles;
CREATE POLICY "Public Read Profiles" ON profiles FOR SELECT USING (true);

-- Announcements: Allow read access to everyone
DROP POLICY IF EXISTS "Public Read Announcements" ON announcements;
CREATE POLICY "Public Read Announcements" ON announcements FOR SELECT USING (true);

-- Financial Documents: Restrict to authenticated uploads/deletes (already exists in storage, but here for table)
DROP POLICY IF EXISTS "Public Read Documents" ON documents;
CREATE POLICY "Public Read Documents" ON documents FOR SELECT USING (true);

-- 22. Seed Data & Defaults
INSERT INTO school_settings (id, school_name) 
VALUES ('00000000-0000-0000-0000-000000000000', 'KENYA HIGH SCHOOL')
ON CONFLICT DO NOTHING;

-- 24. Academic Years Tracking
CREATE TABLE IF NOT EXISTS academic_years (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year TEXT UNIQUE NOT NULL, -- e.g "2024", "2025"
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE academic_years DISABLE ROW LEVEL SECURITY;

-- 25. Promotion Log (History of student movement)
CREATE TABLE IF NOT EXISTS promotion_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  from_class_id UUID REFERENCES classes(id),
  to_class_id UUID REFERENCES classes(id),
  from_level TEXT,
  to_level TEXT,
  academic_year TEXT NOT NULL,
  status TEXT DEFAULT 'success', -- 'success', 'skipped', 'failed'
  reason TEXT,                   -- Detailed reason if skipped or failed
  promoted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE promotion_log DISABLE ROW LEVEL SECURITY;

-- Insert initial academic year
INSERT INTO academic_years (year, is_active) 
VALUES ('2025', true)
ON CONFLICT (year) DO NOTHING;

-- 26. Defaults & Configurations
INSERT INTO school_settings (id, school_name) 
VALUES ('00000000-0000-0000-0000-000000000000', 'KENYA HIGH SCHOOL')
ON CONFLICT DO NOTHING;

INSERT INTO timetable_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000000')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (code, full_name, role, status)
VALUES ('ADM001', 'System Administrator', 'admin', 'active')
ON CONFLICT (code) DO NOTHING;

-- 27. Storage Configuration
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Public Document Views" ON storage.objects;
CREATE POLICY "Public Document Views" ON storage.objects FOR SELECT USING ( bucket_id = 'documents' );

DROP POLICY IF EXISTS "Authenticated Document Uploads" ON storage.objects;
CREATE POLICY "Authenticated Document Uploads" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'documents' );

DROP POLICY IF EXISTS "Authenticated Document Deletions" ON storage.objects;
CREATE POLICY "Authenticated Document Deletions" ON storage.objects FOR DELETE USING ( bucket_id = 'documents' );
