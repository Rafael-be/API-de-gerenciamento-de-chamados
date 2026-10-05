CREATE TABLE IF NOT EXISTS sectors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sectors_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('SUPERUSER', 'TECHNICIAN', 'CLIENT') NOT NULL,
  sector_id BIGINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  password_changed_at DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_is_active (is_active),
  KEY idx_users_sector_id (sector_id),
  CONSTRAINT fk_users_sector FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS technician_stats (
  user_id BIGINT UNSIGNED NOT NULL,
  assumed_total INT UNSIGNED NOT NULL DEFAULT 0,
  in_progress_current INT UNSIGNED NOT NULL DEFAULT 0,
  resolved_total INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_technician_stats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  family_id BINARY(16) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  rotated_at DATETIME NULL,
  revoked_at DATETIME NULL,
  user_agent VARCHAR(255) NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_refresh_token_hash (token_hash),
  KEY idx_refresh_tokens_user (user_id),
  KEY idx_refresh_tokens_family (family_id),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  technician_id BIGINT UNSIGNED NULL,
  sector_id BIGINT UNSIGNED NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
  resolution_note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  assumed_at DATETIME NULL,
  resolved_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_tickets_client_status_created (client_id, status, created_at),
  KEY idx_tickets_technician_status (technician_id, status),
  KEY idx_tickets_status_created (status, created_at),
  KEY idx_tickets_sector_id (sector_id),
  CONSTRAINT fk_tickets_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_technician FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_sector FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ticket_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  body TEXT NOT NULL,
  edited_at DATETIME NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ticket_comments_ticket_parent_created (ticket_id, parent_id, created_at),
  CONSTRAINT fk_ticket_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ticket_comments_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ticket_comments_parent FOREIGN KEY (parent_id) REFERENCES ticket_comments(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(60) NOT NULL,
  ticket_id BIGINT UNSIGNED NULL,
  comment_id BIGINT UNSIGNED NULL,
  actor_id BIGINT UNSIGNED NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_read_created (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_notifications_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_notifications_comment FOREIGN KEY (comment_id) REFERENCES ticket_comments(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  metadata JSON NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  request_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_entity (entity_type, entity_id),
  KEY idx_audit_logs_actor (actor_id),
  KEY idx_audit_logs_created (created_at),
  CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE OR REPLACE VIEW v_ticket_status_summary AS
SELECT status, COUNT(*) AS total
FROM tickets
GROUP BY status;
