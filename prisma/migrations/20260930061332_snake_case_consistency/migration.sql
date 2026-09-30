/*
  Warnings:

  - You are about to drop the column `parentId` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `instruments` table. All the data in the column will be lost.
  - You are about to drop the column `twoFactorSecret` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `comments` DROP FOREIGN KEY `comments_parentId_fkey`;

-- DropIndex
DROP INDEX `comments_parentId_fkey` ON `comments`;

-- DropIndex
DROP INDEX `instruments_market_isActive_idx` ON `instruments`;

-- AlterTable
ALTER TABLE `comments` DROP COLUMN `parentId`,
    ADD COLUMN `parent_id` BIGINT NULL;

-- AlterTable
ALTER TABLE `instruments` DROP COLUMN `isActive`,
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `twoFactorSecret`,
    ADD COLUMN `two_factor_secret` LONGBLOB NULL;

-- CreateIndex
CREATE INDEX `instruments_market_is_active_idx` ON `instruments`(`market`, `is_active`);

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
