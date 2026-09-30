-- CreateTable
CREATE TABLE `sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `user_agent` VARCHAR(255) NULL,
    `ip_address` BINARY(16) NULL,
    `type` ENUM('password', 'google', 'totp', 'recovery_code') NOT NULL DEFAULT 'password',
    `last_used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessions_token_hash_key`(`token_hash`),
    INDEX `sessions_user_id_revoked_at_idx`(`user_id`, `revoked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ulid` CHAR(26) NOT NULL,
    `username` VARCHAR(30) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `email_verified_at` DATETIME(3) NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('trader', 'moderator', 'admin') NOT NULL DEFAULT 'trader',
    `status` ENUM('active', 'suspended', 'banned') NOT NULL DEFAULT 'active',
    `twoFactorSecret` LONGBLOB NULL,
    `two_factor_enabled_at` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `last_login_ip` BINARY(16) NULL,
    `suspended_until` DATETIME(3) NULL,
    `failed_login_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_ulid_key`(`ulid`),
    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_status_role_idx`(`status`, `role`),
    INDEX `users_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_profiles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `bio` TEXT NULL,
    `avatar` VARCHAR(255) NULL,
    `country` CHAR(2) NULL,
    `timezone` VARCHAR(64) NULL,
    `currency` CHAR(3) NULL,
    `social_links` JSON NULL,
    `is_private` BOOLEAN NOT NULL DEFAULT false,
    `show_in_leaderboard` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_profiles_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `password_history_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `requested_ip` BINARY(16) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_user_id_expires_at_idx`(`user_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_two_factor_recovery` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `code_hash` CHAR(64) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_two_factor_recovery_user_id_used_at_idx`(`user_id`, `used_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `instruments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `symbol` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `market` ENUM('forex', 'crypto', 'memecoin') NOT NULL,
    `precision` INTEGER NOT NULL DEFAULT 8,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `risk_flag` VARCHAR(32) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `instruments_symbol_key`(`symbol`),
    INDEX `instruments_market_isActive_idx`(`market`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `strategies` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `description` TEXT NULL,
    `checklist` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `strategies_user_id_idx`(`user_id`),
    UNIQUE INDEX `strategies_user_id_name_key`(`user_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trades` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ulid` CHAR(26) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `instrument_id` BIGINT NOT NULL,
    `strategy_id` BIGINT NULL,
    `market` ENUM('forex', 'crypto', 'memecoin') NOT NULL,
    `side` ENUM('long', 'short') NOT NULL,
    `status` ENUM('open', 'closed', 'cancelled') NOT NULL DEFAULT 'open',
    `visibility` ENUM('public', 'committed') NOT NULL DEFAULT 'public',
    `origin` ENUM('manual', 'csv_import', 'exchange_api') NOT NULL DEFAULT 'manual',
    `entry_price` DECIMAL(36, 18) NULL,
    `stop_loss` DECIMAL(36, 18) NULL,
    `take_profit` DECIMAL(36, 18) NULL,
    `exit_price` DECIMAL(36, 18) NULL,
    `position_size` DECIMAL(36, 18) NULL,
    `leverage` DECIMAL(8, 2) NOT NULL DEFAULT 1,
    `fees` DECIMAL(36, 18) NOT NULL DEFAULT 0,
    `risk_amount` DECIMAL(36, 18) NULL,
    `pnl` DECIMAL(36, 18) NULL,
    `r_multiple` DECIMAL(36, 18) NULL,
    `opened_at` DATETIME(3) NOT NULL,
    `closed_at` DATETIME(3) NULL,
    `meta` JSON NULL,
    `reason` TEXT NULL,
    `review` TEXT NULL,
    `emotion` ENUM('calm', 'fomo', 'greed', 'fear', 'revenge', 'boredom', 'confidence', 'hesitation', 'other') NULL,
    `current_revision` INTEGER NOT NULL DEFAULT 1,
    `chain_block_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `trades_ulid_key`(`ulid`),
    INDEX `trades_user_id_opened_at_idx`(`user_id`, `opened_at`),
    INDEX `trades_market_status_opened_at_idx`(`market`, `status`, `opened_at`),
    INDEX `trades_instrument_id_opened_at_idx`(`instrument_id`, `opened_at`),
    INDEX `trades_visibility_created_at_idx`(`visibility`, `created_at`),
    INDEX `trades_status_opened_at_idx`(`status`, `opened_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trade_revisions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `trade_id` BIGINT NOT NULL,
    `revision_no` INTEGER NOT NULL,
    `snapshot` JSON NOT NULL,
    `change_reason` VARCHAR(500) NOT NULL,
    `created_by` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `trade_revisions_created_at_idx`(`created_at`),
    UNIQUE INDEX `trade_revisions_trade_id_revision_no_key`(`trade_id`, `revision_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trade_media` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `trade_id` BIGINT NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `format` VARCHAR(16) NOT NULL,
    `detected_mime` VARCHAR(64) NOT NULL,
    `byte_size` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `content_hash` CHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `trade_media_trade_id_idx`(`trade_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(40) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tags_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trade_tags` (
    `trade_id` BIGINT NOT NULL,
    `tag_id` BIGINT NOT NULL,

    INDEX `trade_tags_tag_id_idx`(`tag_id`),
    PRIMARY KEY (`trade_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chain_blocks` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `height` INTEGER NOT NULL,
    `trade_id` BIGINT NULL,
    `revision_no` INTEGER NULL,
    `revision_id` BIGINT NULL,
    `payload_hash` CHAR(64) NOT NULL,
    `prev_hash` CHAR(64) NOT NULL,
    `block_hash` CHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `chain_blocks_block_hash_key`(`block_hash`),
    INDEX `chain_blocks_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `chain_blocks_trade_id_idx`(`trade_id`),
    UNIQUE INDEX `chain_blocks_user_id_height_key`(`user_id`, `height`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `merkle_anchors` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `anchor_date` DATE NOT NULL,
    `merkle_root` CHAR(64) NOT NULL,
    `block_count` INTEGER NOT NULL,
    `external_ref` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `merkle_anchors_anchor_date_key`(`anchor_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `follows` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `follower_id` BIGINT NOT NULL,
    `followed_id` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `follows_followed_id_idx`(`followed_id`),
    UNIQUE INDEX `follows_follower_id_followed_id_key`(`follower_id`, `followed_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `trade_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `parentId` BIGINT NULL,
    `body` TEXT NOT NULL,
    `hidden_at` DATETIME(3) NULL,
    `hidden_by` BIGINT NULL,
    `hidden_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `comments_trade_id_created_at_idx`(`trade_id`, `created_at`),
    INDEX `comments_user_id_idx`(`user_id`),
    INDEX `comments_hidden_at_idx`(`hidden_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `likes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `trade_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `likes_user_id_idx`(`user_id`),
    UNIQUE INDEX `likes_trade_id_user_id_key`(`trade_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reports` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `reporter_id` BIGINT NULL,
    `entity_type` VARCHAR(32) NOT NULL,
    `entity_id` BIGINT NOT NULL,
    `entity_ulid` CHAR(26) NULL,
    `reason` ENUM('spam', 'scam', 'pump_and_dump', 'harassment', 'misinformation', 'off_topic', 'other') NOT NULL,
    `detail` VARCHAR(1000) NULL,
    `status` ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
    `resolved_by` BIGINT NULL,
    `resolution` VARCHAR(500) NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reports_status_created_at_idx`(`status`, `created_at`),
    INDEX `reports_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `reports_reporter_id_idx`(`reporter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `type` ENUM('followed_trader_opened', 'followed_trader_closed', 'comment_reply', 'comment_hidden', 'report_resolved', 'integrity_anomaly') NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `body` VARCHAR(500) NULL,
    `link` VARCHAR(255) NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_read_at_created_at_idx`(`user_id`, `read_at`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trader_stats` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `total_trades` INTEGER NOT NULL DEFAULT 0,
    `closed_trades` INTEGER NOT NULL DEFAULT 0,
    `open_trades` INTEGER NOT NULL DEFAULT 0,
    `wins` INTEGER NOT NULL DEFAULT 0,
    `losses` INTEGER NOT NULL DEFAULT 0,
    `total_pnl` DECIMAL(36, 18) NOT NULL DEFAULT 0,
    `gross_profit` DECIMAL(36, 18) NOT NULL DEFAULT 0,
    `gross_loss` DECIMAL(36, 18) NOT NULL DEFAULT 0,
    `win_rate` DECIMAL(9, 6) NOT NULL DEFAULT 0,
    `profit_factor` DECIMAL(36, 18) NOT NULL DEFAULT 0,
    `avg_r` DECIMAL(36, 18) NOT NULL DEFAULT 0,
    `expectancy` DECIMAL(36, 18) NOT NULL DEFAULT 0,
    `max_drawdown` DECIMAL(36, 18) NOT NULL DEFAULT 0,
    `max_drawdown_pct` DECIMAL(9, 6) NOT NULL DEFAULT 0,
    `avg_duration_sec` DECIMAL(36, 18) NOT NULL DEFAULT 0,
    `largest_win` DECIMAL(36, 18) NOT NULL DEFAULT 0,
    `largest_loss` DECIMAL(36, 18) NOT NULL DEFAULT 0,
    `current_streak` INTEGER NOT NULL DEFAULT 0,
    `best_win_streak` INTEGER NOT NULL DEFAULT 0,
    `worst_loss_streak` INTEGER NOT NULL DEFAULT 0,
    `equity_curve` JSON NULL,
    `daily_pnl` JSON NULL,
    `chain_length` INTEGER NOT NULL DEFAULT 0,
    `chain_head_hash` CHAR(64) NULL,
    `has_revisions` BOOLEAN NOT NULL DEFAULT false,
    `integrity_verified` DATETIME(3) NULL,
    `computed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `trader_stats_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `actor_id` BIGINT NULL,
    `action` VARCHAR(80) NOT NULL,
    `entity_type` VARCHAR(32) NULL,
    `entity_id` BIGINT NULL,
    `ip_address` BINARY(16) NULL,
    `user_agent` VARCHAR(255) NULL,
    `context` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_actor_id_created_at_idx`(`actor_id`, `created_at`),
    INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NULL,
    `email_hash` CHAR(64) NOT NULL,
    `ip_address` BINARY(16) NULL,
    `user_agent` VARCHAR(255) NULL,
    `successful` BOOLEAN NOT NULL DEFAULT false,
    `failure_reason` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempts_email_hash_created_at_idx`(`email_hash`, `created_at`),
    INDEX `login_attempts_ip_address_created_at_idx`(`ip_address`, `created_at`),
    INDEX `login_attempts_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `market_candles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `symbol` VARCHAR(32) NOT NULL,
    `interval` VARCHAR(8) NOT NULL,
    `open_time` DATETIME(3) NOT NULL,
    `open` DECIMAL(36, 18) NOT NULL,
    `high` DECIMAL(36, 18) NOT NULL,
    `low` DECIMAL(36, 18) NOT NULL,
    `close` DECIMAL(36, 18) NOT NULL,
    `volume` DECIMAL(36, 18) NOT NULL DEFAULT 0,
    `source` VARCHAR(32) NOT NULL,
    `fetched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `market_candles_symbol_open_time_idx`(`symbol`, `open_time`),
    UNIQUE INDEX `market_candles_symbol_interval_open_time_key`(`symbol`, `interval`, `open_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `key` VARCHAR(80) NOT NULL,
    `value` JSON NOT NULL,
    `updated_by` BIGINT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `queue` VARCHAR(64) NOT NULL DEFAULT 'default',
    `handler` VARCHAR(120) NOT NULL,
    `payload` JSON NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `max_attempts` INTEGER NOT NULL DEFAULT 3,
    `available_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reserved_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `last_error` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `jobs_queue_available_at_idx`(`queue`, `available_at`),
    INDEX `jobs_completed_at_failed_at_idx`(`completed_at`, `failed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_runs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `job_id` BIGINT NULL,
    `queue` VARCHAR(64) NOT NULL,
    `handler` VARCHAR(120) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `duration_ms` INTEGER NOT NULL DEFAULT 0,
    `error` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `job_runs_queue_created_at_idx`(`queue`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_history` ADD CONSTRAINT `password_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_two_factor_recovery` ADD CONSTRAINT `user_two_factor_recovery_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `strategies` ADD CONSTRAINT `strategies_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trades` ADD CONSTRAINT `trades_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trades` ADD CONSTRAINT `trades_instrument_id_fkey` FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trades` ADD CONSTRAINT `trades_strategy_id_fkey` FOREIGN KEY (`strategy_id`) REFERENCES `strategies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trade_revisions` ADD CONSTRAINT `trade_revisions_trade_id_fkey` FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trade_revisions` ADD CONSTRAINT `trade_revisions_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trade_media` ADD CONSTRAINT `trade_media_trade_id_fkey` FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trade_tags` ADD CONSTRAINT `trade_tags_trade_id_fkey` FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trade_tags` ADD CONSTRAINT `trade_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chain_blocks` ADD CONSTRAINT `chain_blocks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chain_blocks` ADD CONSTRAINT `chain_blocks_trade_id_fkey` FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chain_blocks` ADD CONSTRAINT `chain_blocks_revision_id_fkey` FOREIGN KEY (`revision_id`) REFERENCES `trade_revisions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follows` ADD CONSTRAINT `follows_follower_id_fkey` FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follows` ADD CONSTRAINT `follows_followed_id_fkey` FOREIGN KEY (`followed_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_trade_id_fkey` FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `likes` ADD CONSTRAINT `likes_trade_id_fkey` FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `likes` ADD CONSTRAINT `likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trader_stats` ADD CONSTRAINT `trader_stats_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_attempts` ADD CONSTRAINT `login_attempts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
