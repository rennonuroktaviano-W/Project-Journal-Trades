-- TradeLedger — bootstrap database (PRD 7.1, 7.3)
--
-- Langkah 1 dari 2. Jalankan sebagai root MySQL SEBELUM `prisma migrate`:
--   mysql -u root -p < database/01-bootstrap.sql
--
-- Menghasilkan dua akun dengan hak paling kecil (PRD 7.3):
--   tradeledger_migrate  DDL penuh, hanya untuk `prisma migrate`
--   tradeledger_app      DML umum
--
-- Pengetatan tabel append-only ada di 02-append-only-guard.sql dan dijalankan
-- SESUDAH tabel dibuat, karena REVOKE terhadap tabel yang belum ada akan error.

SET @APP_PASSWORD = 'GANTI_DENGAN_PASSWORD_APP';
SET @MIG_PASSWORD = 'GANTI_DENGAN_PASSWORD_MIGRATE';

CREATE DATABASE IF NOT EXISTS `tradeledger`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- IDENTIFIED BY tidak menerima variabel MySQL, jadi lewat prepared statement.
SET @sql = CONCAT(
  'CREATE USER IF NOT EXISTS ''tradeledger_app''@''localhost'' IDENTIFIED BY ''',
  REPLACE(@APP_PASSWORD, '''', ''''''), '''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = CONCAT(
  'CREATE USER IF NOT EXISTS ''tradeledger_app''@''127.0.0.1'' IDENTIFIED BY ''',
  REPLACE(@APP_PASSWORD, '''', ''''''), '''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = CONCAT(
  'CREATE USER IF NOT EXISTS ''tradeledger_migrate''@''localhost'' IDENTIFIED BY ''',
  REPLACE(@MIG_PASSWORD, '''', ''''''), '''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = CONCAT(
  'CREATE USER IF NOT EXISTS ''tradeledger_migrate''@''127.0.0.1'' IDENTIFIED BY ''',
  REPLACE(@MIG_PASSWORD, '''', ''''''), '''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Akun migrasi: DDL penuh (CREATE/ALTER/DROP/INDEX/TRIGGER/REFERENCES)
GRANT ALL PRIVILEGES ON `tradeledger`.* TO 'tradeledger_migrate'@'localhost';
GRANT ALL PRIVILEGES ON `tradeledger`.* TO 'tradeledger_migrate'@'127.0.0.1';

-- Akun aplikasi: DML umum. Pengetatan per tabel menyusul di langkah 2.
GRANT SELECT, INSERT, UPDATE, DELETE ON `tradeledger`.* TO 'tradeledger_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `tradeledger`.* TO 'tradeledger_app'@'127.0.0.1';

FLUSH PRIVILEGES;

SELECT user, host FROM mysql.user WHERE user LIKE 'tradeledger%' ORDER BY user, host;