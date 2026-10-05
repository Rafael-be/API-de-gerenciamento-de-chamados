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
