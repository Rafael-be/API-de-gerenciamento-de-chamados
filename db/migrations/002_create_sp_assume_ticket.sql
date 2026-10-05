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
