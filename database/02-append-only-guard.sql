-- TradeLedger — pengetatan tabel append-only (PRD 7.3)
--
-- Langkah 2 dari 2. Jalankan sebagai root MySQL SESUDAH `prisma migrate`:
--   mysql -u root -p < database/02-append-only-guard.sql
--
-- Tiga lapis perlindungan data integritas:
--   1. Hak MySQL   : akun aplikasi dicabut UPDATE dan DELETE
--   2. Trigger     : BEFORE UPDATE/DELETE melempar error
--   3. Kode        : tidak ada action di aplikasi yang mengubah tabel ini
--
-- Lapis 1 protects Against akun aplikasi langsung. Lapis 2 protects Against
-- akun lain yang punya hak penuh, selama trigger tidak di-drop. Lapis 3
-- mencegah Intenti kode.

-- ---------------------------------------------------------------- lapis 1
REVOKE UPDATE, DELETE ON `tradeledger`.`chain_blocks`    FROM 'tradeledger_app'@'localhost';
REVOKE UPDATE, DELETE ON `tradeledger`.`chain_blocks`    FROM 'tradeledger_app'@'127.0.0.1';
REVOKE UPDATE, DELETE ON `tradeledger`.`trade_revisions` FROM 'tradeledger_app'@'localhost';
REVOKE UPDATE, DELETE ON `tradeledger`.`trade_revisions` FROM 'tradeledger_app'@'127.0.0.1';
REVOKE UPDATE, DELETE ON `tradeledger`.`audit_logs`      FROM 'tradeledger_app'@'localhost';
REVOKE UPDATE, DELETE ON `tradeledger`.`audit_logs`      FROM 'tradeledger_app'@'127.0.0.1';
REVOKE UPDATE, DELETE ON `tradeledger`.`merkle_anchors`  FROM 'tradeledger_app'@'localhost';
REVOKE UPDATE, DELETE ON `tradeledger`.`merkle_anchors`  FROM 'tradeledger_app'@'127.0.0.1';

FLUSH PRIVILEGES;

-- ---------------------------------------------------------------- lapis 2
DROP TRIGGER IF EXISTS `chain_blocks_no_update`;
DROP TRIGGER IF EXISTS `chain_blocks_no_delete`;
DROP TRIGGER IF EXISTS `trade_revisions_no_update`;
DROP TRIGGER IF EXISTS `trade_revisions_no_delete`;
DROP TRIGGER IF EXISTS `audit_logs_no_update`;
DROP TRIGGER IF EXISTS `audit_logs_no_delete`;
DROP TRIGGER IF EXISTS `merkle_anchors_no_update`;
DROP TRIGGER IF EXISTS `merkle_anchors_no_delete`;

DELIMITER $$

CREATE TRIGGER `chain_blocks_no_update` BEFORE UPDATE ON `tradeledger`.`chain_blocks`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'chain_blocks bersifat append-only: UPDATE ditolak';

CREATE TRIGGER `chain_blocks_no_delete` BEFORE DELETE ON `tradeledger`.`chain_blocks`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'chain_blocks bersifat append-only: DELETE ditolak';

CREATE TRIGGER `trade_revisions_no_update` BEFORE UPDATE ON `tradeledger`.`trade_revisions`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'trade_revisions bersifat append-only: UPDATE ditolak';

CREATE TRIGGER `trade_revisions_no_delete` BEFORE DELETE ON `tradeledger`.`trade_revisions`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'trade_revisions bersifat append-only: DELETE ditolak';

CREATE TRIGGER `audit_logs_no_update` BEFORE UPDATE ON `tradeledger`.`audit_logs`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'audit_logs bersifat append-only: UPDATE ditolak';

CREATE TRIGGER `audit_logs_no_delete` BEFORE DELETE ON `tradeledger`.`audit_logs`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'audit_logs bersifat append-only: DELETE ditolak';

CREATE TRIGGER `merkle_anchors_no_update` BEFORE UPDATE ON `tradeledger`.`merkle_anchors`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'merkle_anchors bersifat append-only: UPDATE ditolak';

CREATE TRIGGER `merkle_anchors_no_delete` BEFORE DELETE ON `tradeledger`.`merkle_anchors`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'merkle_anchors bersifat append-only: DELETE ditolak';

DELIMITER ;

-- Verifikasi: jumlah trigger yang harusnya ada
SELECT COUNT(*) AS trigger_append_only FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = 'tradeledger';