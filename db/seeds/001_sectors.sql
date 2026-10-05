INSERT INTO sectors (name, is_active) VALUES
  ('TI', 1),
  ('RH', 1),
  ('Financeiro', 1),
  ('Comercial', 1),
  ('Operações', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = VALUES(is_active);
