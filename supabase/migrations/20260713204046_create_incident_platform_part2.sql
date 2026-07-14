/*
# RAM Handling IT Incident Platform — Part 2: Incidents and related tables

Creates incidents, comments, attachments, history, notifications, activity_logs.
*/

-- INCIDENTS
CREATE SEQUENCE IF NOT EXISTS incident_number_seq START 1000;

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer UNIQUE DEFAULT nextval('incident_number_seq'),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'pending', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  location text,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  solution text,
  resolved_at timestamptz,
  closed_at timestamptz,
  sla_breach boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_reporter ON incidents(reporter_id);
CREATE INDEX IF NOT EXISTS idx_incidents_assignee ON incidents(assignee_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidents_select" ON incidents;
CREATE POLICY "incidents_select" ON incidents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "incidents_insert" ON incidents;
CREATE POLICY "incidents_insert" ON incidents FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "incidents_update" ON incidents;
CREATE POLICY "incidents_update" ON incidents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "incidents_delete" ON incidents;
CREATE POLICY "incidents_delete" ON incidents FOR DELETE TO authenticated USING (true);

-- INCIDENT COMMENTS
CREATE TABLE IF NOT EXISTS incident_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_incident ON incident_comments(incident_id);

ALTER TABLE incident_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select" ON incident_comments;
CREATE POLICY "comments_select" ON incident_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "comments_insert" ON incident_comments;
CREATE POLICY "comments_insert" ON incident_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments_update" ON incident_comments;
CREATE POLICY "comments_update" ON incident_comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "comments_delete" ON incident_comments;
CREATE POLICY "comments_delete" ON incident_comments FOR DELETE TO authenticated USING (true);

-- INCIDENT ATTACHMENTS
CREATE TABLE IF NOT EXISTS incident_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE incident_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attach_select" ON incident_attachments;
CREATE POLICY "attach_select" ON incident_attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "attach_insert" ON incident_attachments;
CREATE POLICY "attach_insert" ON incident_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);
DROP POLICY IF EXISTS "attach_update" ON incident_attachments;
CREATE POLICY "attach_update" ON incident_attachments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "attach_delete" ON incident_attachments;
CREATE POLICY "attach_delete" ON incident_attachments FOR DELETE TO authenticated USING (true);

-- INCIDENT HISTORY
CREATE TABLE IF NOT EXISTS incident_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_history_incident ON incident_history(incident_id);

ALTER TABLE incident_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "history_select" ON incident_history;
CREATE POLICY "history_select" ON incident_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "history_insert" ON incident_history;
CREATE POLICY "history_insert" ON incident_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = changed_by);
DROP POLICY IF EXISTS "history_update" ON incident_history;
CREATE POLICY "history_update" ON incident_history FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "history_delete" ON incident_history;
CREATE POLICY "history_delete" ON incident_history FOR DELETE TO authenticated USING (true);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select" ON notifications;
CREATE POLICY "notif_select" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "notif_update" ON notifications;
CREATE POLICY "notif_update" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_delete" ON notifications;
CREATE POLICY "notif_delete" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_select" ON activity_logs;
CREATE POLICY "activity_select" ON activity_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "activity_insert" ON activity_logs;
CREATE POLICY "activity_insert" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "activity_update" ON activity_logs;
CREATE POLICY "activity_update" ON activity_logs FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "activity_delete" ON activity_logs;
CREATE POLICY "activity_delete" ON activity_logs FOR DELETE TO authenticated USING (true);
