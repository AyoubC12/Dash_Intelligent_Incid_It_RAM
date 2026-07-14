import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'employee' | 'technician' | 'admin';
export type IncidentStatus = 'new' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type IncidentPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department_id: string | null;
  phone: string | null;
  location: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  departments?: Department;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  manager_name: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  created_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  created_at: string;
  categories?: Category;
}

export interface SlaConfig {
  id: string;
  priority: IncidentPriority;
  response_time_hours: number;
  resolution_time_hours: number;
}

export interface Incident {
  id: string;
  number: number;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  category_id: string | null;
  subcategory_id: string | null;
  department_id: string | null;
  location: string | null;
  reporter_id: string;
  assignee_id: string | null;
  solution: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  sla_breach: boolean;
  created_at: string;
  updated_at: string;
  categories?: Category;
  subcategories?: Subcategory;
  departments?: Department;
  reporter?: Profile;
  assignee?: Profile;
}

export interface IncidentComment {
  id: string;
  incident_id: string;
  author_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  author?: Profile;
}

export interface IncidentAttachment {
  id: string;
  incident_id: string;
  uploader_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

export interface IncidentHistory {
  id: string;
  incident_id: string;
  changed_by: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  changer?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  incident_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user?: Profile;
}
