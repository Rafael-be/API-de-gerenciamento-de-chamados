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
