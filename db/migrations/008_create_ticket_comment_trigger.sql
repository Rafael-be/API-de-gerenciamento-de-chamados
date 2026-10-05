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
