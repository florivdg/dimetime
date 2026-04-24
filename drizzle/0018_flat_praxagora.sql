CREATE TABLE `apikey` (
	`id` text PRIMARY KEY NOT NULL,
	`config_id` text DEFAULT 'default' NOT NULL,
	`name` text,
	`start` text,
	`reference_id` text NOT NULL,
	`prefix` text,
	`key` text NOT NULL,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`enabled` integer DEFAULT true,
	`rate_limit_enabled` integer DEFAULT true,
	`rate_limit_time_window` integer DEFAULT 60000,
	`rate_limit_max` integer DEFAULT 120,
	`request_count` integer DEFAULT 0,
	`remaining` integer,
	`last_request` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`permissions` text,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `apikey_configId_idx` ON `apikey` (`config_id`);--> statement-breakpoint
CREATE INDEX `apikey_referenceId_idx` ON `apikey` (`reference_id`);--> statement-breakpoint
CREATE INDEX `apikey_key_idx` ON `apikey` (`key`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_statement_import` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`file_name` text,
	`file_sha256` text,
	`file_type` text NOT NULL,
	`phase` text NOT NULL,
	`status` text NOT NULL,
	`preview_count` integer DEFAULT 0 NOT NULL,
	`imported_count` integer DEFAULT 0 NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`triggered_by_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `import_source`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`triggered_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_statement_import`("id", "source_id", "file_name", "file_sha256", "file_type", "phase", "status", "preview_count", "imported_count", "updated_count", "skipped_count", "error_message", "triggered_by_user_id", "created_at") SELECT "id", "source_id", "file_name", "file_sha256", "file_type", "phase", "status", "preview_count", "imported_count", "updated_count", "skipped_count", "error_message", "triggered_by_user_id", "created_at" FROM `statement_import`;--> statement-breakpoint
DROP TABLE `statement_import`;--> statement-breakpoint
ALTER TABLE `__new_statement_import` RENAME TO `statement_import`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `statementImport_sourceId_idx` ON `statement_import` (`source_id`);--> statement-breakpoint
CREATE INDEX `statementImport_fileSha256_idx` ON `statement_import` (`file_sha256`);--> statement-breakpoint
CREATE INDEX `statementImport_createdAt_idx` ON `statement_import` (`created_at`);--> statement-breakpoint
ALTER TABLE `two_factor` ADD `verified` integer DEFAULT true;--> statement-breakpoint
CREATE INDEX `twoFactor_secret_idx` ON `two_factor` (`secret`);