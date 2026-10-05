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
