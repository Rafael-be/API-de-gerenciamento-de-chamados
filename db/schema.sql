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

CREATE PROCEDURE sp_assume_ticket(IN p_ticket_id BIGINT UNSIGNED, IN p_technician_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_status VARCHAR(20);

  SELECT status INTO v_status
  FROM tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_NOT_FOUND';
  END IF;

  IF v_status <> 'OPEN' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_INVALID_TRANSITION';
  END IF;

  UPDATE tickets
  SET technician_id = p_technician_id,
      status = 'IN_PROGRESS',
      assumed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_ticket_id AND status = 'OPEN' AND technician_id IS NULL;

  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_ALREADY_ASSUMED';
  END IF;
END;

CREATE PROCEDURE sp_return_ticket(IN p_ticket_id BIGINT UNSIGNED, IN p_technician_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_current_technician BIGINT UNSIGNED;

  SELECT technician_id INTO v_current_technician
  FROM tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF v_current_technician IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_NOT_FOUND';
  END IF;

  IF v_current_technician <> p_technician_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NOT_ASSIGNED_TECHNICIAN';
  END IF;

  UPDATE tickets
  SET technician_id = NULL,
      status = 'OPEN',
      assumed_at = NULL,
      updated_at = NOW()
  WHERE id = p_ticket_id AND status = 'IN_PROGRESS';

  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_INVALID_TRANSITION';
  END IF;
END;

CREATE PROCEDURE sp_finish_ticket(IN p_ticket_id BIGINT UNSIGNED, IN p_technician_id BIGINT UNSIGNED, IN p_resolution_note TEXT)
BEGIN
  DECLARE v_current_technician BIGINT UNSIGNED;

  SELECT technician_id INTO v_current_technician
  FROM tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF v_current_technician IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_NOT_FOUND';
  END IF;

  IF v_current_technician <> p_technician_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NOT_ASSIGNED_TECHNICIAN';
  END IF;

  UPDATE tickets
  SET status = 'RESOLVED',
      resolution_note = p_resolution_note,
      resolved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_ticket_id AND status = 'IN_PROGRESS';

  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_ALREADY_RESOLVED';
  END IF;
END;

CREATE PROCEDURE sp_cancel_ticket(IN p_ticket_id BIGINT UNSIGNED, IN p_client_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_client_id BIGINT UNSIGNED;
  DECLARE v_status VARCHAR(20);

  SELECT client_id, status INTO v_client_id, v_status
  FROM tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF v_client_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_NOT_FOUND';
  END IF;

  IF v_client_id <> p_client_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NOT_TICKET_OWNER';
  END IF;

  IF v_status NOT IN ('OPEN', 'IN_PROGRESS') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_INVALID_TRANSITION';
  END IF;

  UPDATE tickets
  SET status = 'CANCELLED',
      cancelled_at = NOW(),
      updated_at = NOW(),
      technician_id = CASE WHEN status = 'IN_PROGRESS' THEN NULL ELSE technician_id END
  WHERE id = p_ticket_id AND status IN ('OPEN', 'IN_PROGRESS');

  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_ALREADY_CANCELLED';
  END IF;
END;

CREATE PROCEDURE sp_deactivate_technician(IN p_technician_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_is_active TINYINT(1);

  SELECT is_active INTO v_is_active
  FROM users
  WHERE id = p_technician_id
  FOR UPDATE;

  IF v_is_active IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'USER_NOT_FOUND';
  END IF;

  UPDATE users
  SET is_active = 0,
      updated_at = NOW()
  WHERE id = p_technician_id AND role = 'TECHNICIAN';

  UPDATE tickets
  SET status = 'OPEN',
      technician_id = NULL,
      assumed_at = NULL,
      updated_at = NOW()
  WHERE technician_id = p_technician_id AND status = 'IN_PROGRESS';

  SELECT DISTINCT client_id
  FROM tickets
  WHERE technician_id = p_technician_id AND status = 'OPEN';
END;

CREATE TRIGGER trg_tickets_before_update
BEFORE UPDATE ON tickets
FOR EACH ROW
BEGIN
  IF NEW.status IN ('RESOLVED', 'CANCELLED') AND OLD.status IN ('RESOLVED', 'CANCELLED') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_FROZEN';
  END IF;

  IF NEW.status = 'RESOLVED' AND OLD.status <> 'IN_PROGRESS' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_INVALID_TRANSITION';
  END IF;

  IF NEW.status = 'CANCELLED' AND OLD.status NOT IN ('OPEN', 'IN_PROGRESS') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_INVALID_TRANSITION';
  END IF;

  IF NEW.status = 'IN_PROGRESS' AND (NEW.technician_id IS NULL OR NEW.technician_id = 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_INVALID_TRANSITION';
  END IF;

  IF OLD.status = 'OPEN' AND NEW.title <> OLD.title THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_NOT_EDITABLE';
  END IF;

  IF OLD.status = 'OPEN' AND NEW.description <> OLD.description THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_NOT_EDITABLE';
  END IF;
END;

CREATE TRIGGER trg_ticket_comments_before_insert
BEFORE INSERT ON ticket_comments
FOR EACH ROW
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM ticket_comments
      WHERE id = NEW.parent_id AND ticket_id = NEW.ticket_id AND parent_id IS NULL
    ) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REPLY_TO_REPLY_NOT_ALLOWED';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM tickets
    WHERE id = NEW.ticket_id AND status IN ('OPEN', 'IN_PROGRESS')
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TICKET_FROZEN';
  END IF;
END;

CREATE TRIGGER trg_users_after_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  IF NEW.role = 'TECHNICIAN' THEN
    INSERT INTO technician_stats (user_id, assumed_total, in_progress_current, resolved_total)
    VALUES (NEW.id, 0, 0, 0)
    ON DUPLICATE KEY UPDATE user_id = NEW.id;
  END IF;
END;

INSERT INTO sectors (name, is_active) VALUES
  ('TI', 1),
  ('RH', 1),
  ('Financeiro', 1),
  ('Comercial', 1),
  ('Operações', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = VALUES(is_active);
