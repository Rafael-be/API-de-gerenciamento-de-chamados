ALTER TABLE sectors MODIFY name VARCHAR(100) NOT NULL;

ALTER TABLE users MODIFY email VARCHAR(190) NOT NULL;
ALTER TABLE users ADD COLUMN superuser_flag TINYINT GENERATED ALWAYS AS (IF(role = 'SUPERUSER', 1, NULL)) STORED AFTER updated_at;
ALTER TABLE users DROP INDEX uk_users_email;
ALTER TABLE users ADD UNIQUE KEY uq_users_email (email);
ALTER TABLE users ADD UNIQUE KEY uq_users_single_superuser (superuser_flag);

ALTER TABLE refresh_tokens MODIFY family_id CHAR(36) NOT NULL;

ALTER TABLE tickets ADD CONSTRAINT chk_tickets_in_progress_has_tech CHECK (status <> 'IN_PROGRESS' OR technician_id IS NOT NULL);

ALTER TABLE notifications DROP FOREIGN KEY fk_notifications_ticket;
ALTER TABLE notifications DROP FOREIGN KEY fk_notifications_comment;
ALTER TABLE notifications DROP FOREIGN KEY fk_notifications_actor;
ALTER TABLE notifications MODIFY type ENUM('TICKET_ASSUMED','TICKET_RETURNED','TICKET_RESOLVED','TICKET_CANCELLED','TECHNICIAN_DEACTIVATED','COMMENT_CREATED') NOT NULL;
ALTER TABLE notifications MODIFY message VARCHAR(255) NOT NULL;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_comment FOREIGN KEY (comment_id) REFERENCES ticket_comments(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE audit_logs DROP FOREIGN KEY fk_audit_logs_actor;
