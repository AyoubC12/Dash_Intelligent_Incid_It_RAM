/*
# RAM Handling IT Incident Platform — Part 1: Core tables without cross-references

Creates departments, profiles, categories, subcategories, sla_configs.
Profiles policies are simple (self-only) to avoid circular dependency.
*/

-- DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  manager_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dept_select" ON departments;
CREATE POLICY "dept_select" ON departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dept_insert" ON departments;
CREATE POLICY "dept_insert" ON departments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "dept_update" ON departments;
CREATE POLICY "dept_update" ON departments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "dept_delete" ON departments;
CREATE POLICY "dept_delete" ON departments FOR DELETE TO authenticated USING (true);

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'technician', 'admin')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  phone text,
  location text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_select" ON profiles;
CREATE POLICY "profile_select" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profile_insert" ON profiles;
CREATE POLICY "profile_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profile_update" ON profiles;
CREATE POLICY "profile_update" ON profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "profile_delete" ON profiles;
CREATE POLICY "profile_delete" ON profiles FOR DELETE TO authenticated USING (true);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text DEFAULT 'folder',
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cat_select" ON categories;
CREATE POLICY "cat_select" ON categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cat_insert" ON categories;
CREATE POLICY "cat_insert" ON categories FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "cat_update" ON categories;
CREATE POLICY "cat_update" ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cat_delete" ON categories;
CREATE POLICY "cat_delete" ON categories FOR DELETE TO authenticated USING (true);

-- SUBCATEGORIES
CREATE TABLE IF NOT EXISTS subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subcat_select" ON subcategories;
CREATE POLICY "subcat_select" ON subcategories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "subcat_insert" ON subcategories;
CREATE POLICY "subcat_insert" ON subcategories FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "subcat_update" ON subcategories;
CREATE POLICY "subcat_update" ON subcategories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "subcat_delete" ON subcategories;
CREATE POLICY "subcat_delete" ON subcategories FOR DELETE TO authenticated USING (true);

-- SLA CONFIGS
CREATE TABLE IF NOT EXISTS sla_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  priority text NOT NULL UNIQUE CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  response_time_hours integer NOT NULL DEFAULT 24,
  resolution_time_hours integer NOT NULL DEFAULT 72,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sla_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_select" ON sla_configs;
CREATE POLICY "sla_select" ON sla_configs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sla_insert" ON sla_configs;
CREATE POLICY "sla_insert" ON sla_configs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sla_update" ON sla_configs;
CREATE POLICY "sla_update" ON sla_configs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sla_delete" ON sla_configs;
CREATE POLICY "sla_delete" ON sla_configs FOR DELETE TO authenticated USING (true);

-- SEED DATA
INSERT INTO departments (name, description, manager_name) VALUES
  ('Exploitation', 'Operations and ground handling', 'Mohammed Alami'),
  ('Informatique', 'IT Department', 'Karim Benali'),
  ('Finance', 'Finance and Accounting', 'Sara Tazi'),
  ('RH', 'Human Resources', 'Fatima Ouhabi'),
  ('Logistique', 'Logistics and Supply Chain', 'Youssef Mansouri'),
  ('Sécurité', 'Security and Safety', 'Hassan Idrissi'),
  ('Maintenance', 'Technical Maintenance', 'Omar Cherkaoui'),
  ('Commercial', 'Sales and Commercial', 'Nadia Berrada')
ON CONFLICT DO NOTHING;

INSERT INTO categories (name, description, icon, color) VALUES
  ('Réseau', 'Network connectivity and infrastructure issues', 'wifi', '#3B82F6'),
  ('Matériel', 'Hardware failures and equipment issues', 'cpu', '#F59E0B'),
  ('Logiciel', 'Software applications and system issues', 'monitor', '#8B5CF6'),
  ('Sécurité', 'Security incidents and access control', 'shield', '#EF4444'),
  ('Messagerie', 'Email and communication tools', 'mail', '#10B981'),
  ('Imprimante', 'Printing and scanning issues', 'printer', '#F97316'),
  ('Téléphonie', 'Phone and VoIP issues', 'phone', '#06B6D4'),
  ('Serveur', 'Server and infrastructure issues', 'server', '#DC2626')
ON CONFLICT DO NOTHING;

INSERT INTO sla_configs (priority, response_time_hours, resolution_time_hours) VALUES
  ('low', 24, 72),
  ('medium', 8, 24),
  ('high', 4, 8),
  ('critical', 1, 4)
ON CONFLICT (priority) DO NOTHING;
