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
