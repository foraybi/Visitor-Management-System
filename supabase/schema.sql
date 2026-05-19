-- =============================================
-- Visitor Management System - Supabase Schema
-- =============================================
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/nidiuwxozsxydqfvjmll/editor

-- Floors
CREATE TABLE IF NOT EXISTS floors (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  logo_url TEXT,
  phone TEXT NOT NULL,
  floor INTEGER NOT NULL,
  employee_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees (child of companies — cascades on delete)
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_number TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  nationality_type TEXT NOT NULL,
  nationality_id_number TEXT NOT NULL,
  country_code TEXT NOT NULL,
  gender TEXT NOT NULL,
  employment_status TEXT NOT NULL DEFAULT 'active',
  job_type TEXT NOT NULL,
  department TEXT,
  position TEXT,
  hire_date TEXT,
  photo_data_url TEXT,
  notes TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visitors
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  nationality_type TEXT NOT NULL,
  nationality_id_number TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  visitor_type TEXT NOT NULL,
  visited_company_id TEXT NOT NULL,
  floor INTEGER NOT NULL,
  signature_data_url TEXT NOT NULL,
  entry_time TEXT NOT NULL,
  exit_time TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff profiles (mirrors auth.users for admin-managed staff accounts)
-- Stores admin and frontdesk accounts created through the app.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'frontdesk')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Form config (single row — admin controls which fields are visible on the kiosk)
CREATE TABLE IF NOT EXISTS form_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  fields JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document settings (single row — admin controls PDF header, logo)
CREATE TABLE IF NOT EXISTS document_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  admission_name TEXT DEFAULT '',
  admission_label TEXT DEFAULT 'Admission Name',
  form_id_version TEXT DEFAULT '',
  form_id_version_label TEXT DEFAULT 'Form ID / Version',
  vision_number TEXT DEFAULT '',
  vision_number_label TEXT DEFAULT 'Vision Number',
  form_name TEXT DEFAULT 'Visitor Management Report',
  logo_url TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage buckets (public — logos and photos must be viewable without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('document-logos', 'document-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='storage_public_read') THEN
    CREATE POLICY "storage_public_read" ON storage.objects FOR SELECT USING (bucket_id IN ('employee-photos', 'document-logos'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='storage_auth_insert') THEN
    CREATE POLICY "storage_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('employee-photos', 'document-logos') AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='storage_auth_update') THEN
    CREATE POLICY "storage_auth_update" ON storage.objects FOR UPDATE USING (bucket_id IN ('employee-photos', 'document-logos') AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='storage_auth_delete') THEN
    CREATE POLICY "storage_auth_delete" ON storage.objects FOR DELETE USING (bucket_id IN ('employee-photos', 'document-logos') AND auth.role() = 'authenticated');
  END IF;
END $$;

-- ── RLS (open policies — internal app uses its own auth layer) ──────────────
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Remove the old blanket policy if it exists
  DROP POLICY IF EXISTS "anon_all" ON floors;
  DROP POLICY IF EXISTS "anon_all" ON companies;
  DROP POLICY IF EXISTS "anon_all" ON employees;
  DROP POLICY IF EXISTS "anon_all" ON visitors;
  DROP POLICY IF EXISTS "anon_all" ON profiles;

  -- ── visitors: fully open ────────────────────────────────────────────────
  -- The kiosk (anon key) must INSERT (check-in) and UPDATE (exit) without auth.
  -- This is intentional — the linter will still warn, which is acceptable.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='visitors' AND policyname='visitors_select') THEN
    CREATE POLICY "visitors_select" ON visitors FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='visitors' AND policyname='visitors_insert') THEN
    CREATE POLICY "visitors_insert" ON visitors FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='visitors' AND policyname='visitors_update') THEN
    CREATE POLICY "visitors_update" ON visitors FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  -- ── floors: open read, authenticated write ──────────────────────────────
  -- Kiosk reads floors for the floor selector; only staff (admin) write.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='floors' AND policyname='floors_select') THEN
    CREATE POLICY "floors_select" ON floors FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='floors' AND policyname='floors_modify') THEN
    CREATE POLICY "floors_modify" ON floors FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  -- ── companies: open read, authenticated write ───────────────────────────
  -- Kiosk reads companies for the company selector; only staff write.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='companies' AND policyname='companies_select') THEN
    CREATE POLICY "companies_select" ON companies FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='companies' AND policyname='companies_modify') THEN
    CREATE POLICY "companies_modify" ON companies FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  -- ── employees: open read, authenticated write ───────────────────────────
  -- Kiosk reads employees for ID lookup; only staff write.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='employees_select') THEN
    CREATE POLICY "employees_select" ON employees FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='employees_modify') THEN
    CREATE POLICY "employees_modify" ON employees FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  -- ── profiles: authenticated only ────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_auth') THEN
    CREATE POLICY "profiles_auth" ON profiles FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  -- ── form_config: kiosk can read, authenticated staff write ───────────────
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='form_config' AND policyname='form_config_select') THEN
    CREATE POLICY "form_config_select" ON form_config FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='form_config' AND policyname='form_config_modify') THEN
    CREATE POLICY "form_config_modify" ON form_config FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  -- ── document_settings: kiosk can read, authenticated staff write ─────────
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='document_settings' AND policyname='doc_settings_select') THEN
    CREATE POLICY "doc_settings_select" ON document_settings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='document_settings' AND policyname='doc_settings_modify') THEN
    CREATE POLICY "doc_settings_modify" ON document_settings FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- ── Realtime ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'visitors'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE visitors;
  END IF;
END $$;
ALTER TABLE visitors REPLICA IDENTITY FULL;

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_visitors_date       ON visitors(date);
CREATE INDEX IF NOT EXISTS idx_visitors_status     ON visitors(status);
CREATE INDEX IF NOT EXISTS idx_employees_company   ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_id_number ON employees(nationality_id_number);

-- ══════════════════════════════════════════════════════════════════════════
-- SETUP STEPS (run once after schema is created)
-- ══════════════════════════════════════════════════════════════════════════
--
-- 1. DISABLE EMAIL CONFIRMATION (required so admin-created accounts work instantly):
--    Supabase Dashboard → Authentication → Settings → "Enable email confirmations" → OFF
--
-- 2. CREATE THE FIRST ADMIN ACCOUNT:
--    a. Go to Supabase Dashboard → Authentication → Users → "Add user"
--    b. Enter admin email + password, click "Create user"
--    c. Then run this SQL (replace the email):
--
--       INSERT INTO profiles (id, email, full_name, role)
--       SELECT id, email, 'System Admin', 'admin'
--       FROM auth.users WHERE email = 'admin@yourdomain.com';
--
--       UPDATE auth.users
--       SET raw_user_meta_data = '{"role":"admin"}'
--       WHERE email = 'admin@yourdomain.com';
--
-- ══════════════════════════════════════════════════════════════════════════
