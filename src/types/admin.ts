export interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  is_admin: boolean;
  is_active: boolean;
  last_sign_in_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminRole {
  id: string;
  name: string;
  permissions: string[];
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminPermission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface AdminSession {
  id: string;
  user_id: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource?: string;
  resource_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}
