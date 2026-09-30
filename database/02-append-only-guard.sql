-- TradeLedger — hak aplikasi per tabel dan pengetatan append-only (PRD 7.3)
--
-- Langkah 2 dari 2. Jalankan sebagai root MySQL SESUDAH `prisma migrate`:
--   mysql -u root -p < database/02-append-only-guard.sql
--
-- ULANG script ini setiap kali migrasi menambah tabel baru.
--
-- Tiga lapis perlindungan integritas:
--   1. Hak MySQL   : allow-list per tabel, tabel append-only hanya INSERT+SELECT
--   2. Trigger     : BEFORE UPDATE/DELETE melempar error
--   3. Kode        : tidak ada action di aplikasi yang mengubah tabel ini
--
-- Kenapa allow-list, bukan daftar pengecualian: MySQL tidak bisa mengurangi
-- hak yang diberikan di level `database`.*. Begitu `GRANT ... ON tradeledger.*`
-- diberikan, `REVOKE` per tabel tidak berefek dan tabel append-only tetap bisa
-- di-UPDATE. Jadi hak dicabut dulu di level database, lalu diberikan kembali
-- satu per tabel.
--
-- Lapis 1 mencegah akun aplikasi langsung. Lapis 2 juga melindungi dari akun
-- lain yang punya hak penuh, selama trigger tidak di-drop.

-- Empat tabel append-only disebut langsung sebagai daftar literal, bukan lewat
-- FIND_IN_SET dengan variabel sesi. Perbandingan kolom (utf8mb4_0900_ai_ci)
-- dengan variabel sesi akan gagal sebagai "illegal mix of collations" kalau
-- koneksi masuk dengan charset berbeda, sedangkan literal bersifat coercible dan
-- selalu aman.
SET SESSION group_concat_max_len = 1048576;

-- Procedure dibuat di dalam basis data aplikasi, jadi `USE` wajib ada.
USE `tradeledger`;

-- ------------------------------------------------------------------ lapis 1
-- Hak aplikasi dibangun ulang dari nol setiap kali script ini dijalankan, lewat
-- allow-list per tabel. Stored procedure dipakai karena `PREPARE` hanya menerima
-- satu statement, sedangkan tabelnya banyak.
--
-- Prosedurnya dibuat lalu langsung dibuang supaya tidak menyisakan objek
-- database. Butuh hak CREATE ROUTINE, makanya script ini hanya untuk root.
DROP PROCEDURE IF EXISTS `rebuild_app_grants`;

DELIMITER $$

CREATE PROCEDURE `rebuild_app_grants`()
BEGIN
  DECLARE v_i       INT DEFAULT 0;
  DECLARE v_next    INT DEFAULT 0;
  DECLARE v_total   INT DEFAULT 0;
  DECLARE v_table   VARCHAR(64);
  DECLARE v_host    VARCHAR(255);
  DECLARE v_append  INT;

  -- 1a. Cabut hak di level database kalau masih ada. Ini wajib: selama
  --     `GRANT ... ON tradeledger`.* masih ada, REVOKE per tabel tidak
  --     berefek sama sekali.
  --
  --     Daftar privilege diambil dari information_schema, bukan ditulis manual.
  --     MySQL menolak REVOKE kalau privilege yang disebut tidak pernah diberikan,
  --     jadi menyebut privilege yang tidak ada akan menggagalkan seluruh script.
  SET v_i := 0;
  WHILE v_i < 2 DO
    SET v_host := IF(v_i = 0, 'localhost', '127.0.0.1');

    SET @sql := (
      SELECT CONCAT(
               'REVOKE ', GROUP_CONCAT(PRIVILEGE_TYPE ORDER BY PRIVILEGE_TYPE),
               ' ON `tradeledger`.* FROM ''tradeledger_app''@''', v_host, ''''
             )
        FROM information_schema.SCHEMA_PRIVILEGES
       WHERE TABLE_SCHEMA = 'tradeledger'
         AND GRANTEE = CONCAT('''tradeledger_app''@''', v_host, '''')
    );

    IF @sql IS NOT NULL THEN
      PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    END IF;

    SET v_i := v_i + 1;
  END WHILE;

  -- 1b. Cabut hak per tabel, lalu berikan kembali sesuai allow-list.
  SELECT COUNT(*) INTO v_total
    FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = 'tradeledger'
     AND TABLE_TYPE = 'BASE TABLE'
     AND TABLE_NAME <> '_prisma_migrations';

  SET v_i := 0;
  WHILE v_i < v_total DO
    SELECT TABLE_NAME INTO v_table
      FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = 'tradeledger'
       AND TABLE_TYPE = 'BASE TABLE'
       AND TABLE_NAME <> '_prisma_migrations'
     ORDER BY TABLE_NAME
     LIMIT 1 OFFSET v_i;

    SET v_append = v_table IN ('chain_blocks', 'trade_revisions', 'audit_logs', 'merkle_anchors');

    SET v_i := 0;
    WHILE v_i < 2 DO
      SET v_host := IF(v_i = 0, 'localhost', '127.0.0.1');

      SET @sql := (
        SELECT CONCAT(
                 'REVOKE ', GROUP_CONCAT(PRIVILEGE_TYPE ORDER BY PRIVILEGE_TYPE),
                 ' ON `tradeledger`.`', v_table,
                 '` FROM ''tradeledger_app''@''', v_host, ''''
               )
          FROM information_schema.TABLE_PRIVILEGES
         WHERE TABLE_SCHEMA = 'tradeledger'
           AND TABLE_NAME = v_table
           AND GRANTEE = CONCAT('''tradeledger_app''@''', v_host, '''')
      );

      IF @sql IS NOT NULL THEN
        PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;

      -- Tabel append-only hanya boleh dibaca dan diisi. UPDATE dan DELETE
      -- tidak pernah diberikan, jadi tidak bisa ditembus dari sisi aplikasi.
      SET @sql = IF(
        v_append,
        CONCAT('GRANT SELECT, INSERT ON `tradeledger`.`', v_table,
               '` TO ''tradeledger_app''@''', v_host, ''''),
        CONCAT('GRANT SELECT, INSERT, UPDATE, DELETE ON `tradeledger`.`', v_table,
               '` TO ''tradeledger_app''@''', v_host, '''')
      );

      PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

      SET v_i := v_i + 1;
    END WHILE;

    -- Lanjut ke tabel berikutnya. Menghitung ulang posisi dengan membandingkan
    -- nama tabel dari v_table, karena v_i dipakai ulang oleh loop host di atas.
    SET v_next := (
      SELECT COUNT(*)
        FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = 'tradeledger'
         AND TABLE_TYPE = 'BASE TABLE'
         AND TABLE_NAME <> '_prisma_migrations'
         AND TABLE_NAME <= v_table
    );
    SET v_i := v_next;
  END WHILE;
END$$

DELIMITER ;

CALL `rebuild_app_grants`();
DROP PROCEDURE `rebuild_app_grants`;

FLUSH PRIVILEGES;

-- ------------------------------------------------------------------ lapis 2
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
  SET MESSAGE_TEXT = 'chain_blocks bersifat append-only: UPDATE ditolak'$$

CREATE TRIGGER `chain_blocks_no_delete` BEFORE DELETE ON `tradeledger`.`chain_blocks`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'chain_blocks bersifat append-only: DELETE ditolak'$$

CREATE TRIGGER `trade_revisions_no_update` BEFORE UPDATE ON `tradeledger`.`trade_revisions`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'trade_revisions bersifat append-only: UPDATE ditolak'$$

CREATE TRIGGER `trade_revisions_no_delete` BEFORE DELETE ON `tradeledger`.`trade_revisions`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'trade_revisions bersifat append-only: DELETE ditolak'$$

CREATE TRIGGER `audit_logs_no_update` BEFORE UPDATE ON `tradeledger`.`audit_logs`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'audit_logs bersifat append-only: UPDATE ditolak'$$

CREATE TRIGGER `audit_logs_no_delete` BEFORE DELETE ON `tradeledger`.`audit_logs`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'audit_logs bersifat append-only: DELETE ditolak'$$

CREATE TRIGGER `merkle_anchors_no_update` BEFORE UPDATE ON `tradeledger`.`merkle_anchors`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'merkle_anchors bersifat append-only: UPDATE ditolak'$$

CREATE TRIGGER `merkle_anchors_no_delete` BEFORE DELETE ON `tradeledger`.`merkle_anchors`
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'merkle_anchors bersifat append-only: DELETE ditolak'$$

DELIMITER ;

-- ---------------------------------------------------------------- verifikasi
-- Harusnya kosong: tidak ada UPDATE/DELETE yang masih tertinggal di tabel
-- append-only untuk akun aplikasi.
SELECT TABLE_NAME AS 'tabel', PRIVILEGE_TYPE AS 'masih_punya'
  FROM information_schema.TABLE_PRIVILEGES
 WHERE GRANTEE LIKE '''tradeledger_app''@%'
   AND TABLE_SCHEMA = 'tradeledger'
   AND TABLE_NAME IN ('chain_blocks', 'trade_revisions', 'audit_logs', 'merkle_anchors')
   AND PRIVILEGE_TYPE IN ('UPDATE', 'DELETE');

-- Ringkasan jumlah hak per tabel untuk akun aplikasi.
SELECT TABLE_NAME,
       GROUP_CONCAT(DISTINCT PRIVILEGE_TYPE ORDER BY PRIVILEGE_TYPE) AS 'hak'
  FROM information_schema.TABLE_PRIVILEGES
 WHERE GRANTEE LIKE '''tradeledger_app''@%'
   AND TABLE_SCHEMA = 'tradeledger'
 GROUP BY TABLE_NAME
 ORDER BY TABLE_NAME;

SELECT COUNT(*) AS 'jumlah_trigger_append_only'
  FROM information_schema.TRIGGERS
 WHERE TRIGGER_SCHEMA = 'tradeledger';
