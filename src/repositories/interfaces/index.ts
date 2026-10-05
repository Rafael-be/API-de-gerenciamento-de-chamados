export interface UserRecordRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'SUPERUSER' | 'TECHNICIAN' | 'CLIENT';
  sector_id: number | null;
  is_active: number;
  must_change_password: number;
  password_changed_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SectorRecordRow {
  id: number;
  name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface TicketRecordRow {
  id: number;
  client_id: number;
  technician_id: number | null;
  sector_id: number | null;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  assumed_at: string | null;
  resolved_at: string | null;
  cancelled_at: string | null;
}

export interface CommentRecordRow {
  id: number;
  ticket_id: number;
  author_id: number;
  parent_id: number | null;
  body: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface NotificationRecordRow {
  id: number;
  user_id: number;
  type: string;
  ticket_id: number | null;
  comment_id: number | null;
  actor_id: number | null;
  message: string;
  is_read: number;
  read_at: string | null;
  created_at: string;
}

export interface RefreshTokenRecordRow {
  id: number;
  user_id: number;
  family_id: string;
  token_hash: string;
  expires_at: string;
  rotated_at: string | null;
  revoked_at: string | null;
  created_at: string;
}
