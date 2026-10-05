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
