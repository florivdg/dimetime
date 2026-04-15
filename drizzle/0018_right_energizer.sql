CREATE TABLE `enable_banking_session` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`aspsp_name` text NOT NULL,
	`aspsp_country` text NOT NULL,
	`psu_type` text DEFAULT 'personal' NOT NULL,
	`valid_until` integer NOT NULL,
	`raw_session_json` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `enableBankingSession_status_idx` ON `enable_banking_session` (`status`);--> statement-breakpoint
CREATE INDEX `enableBankingSession_validUntil_idx` ON `enable_banking_session` (`valid_until`);--> statement-breakpoint
ALTER TABLE `import_source` ADD `connection_type` text DEFAULT 'file_upload' NOT NULL;--> statement-breakpoint
ALTER TABLE `import_source` ADD `enable_banking_account_uid` text;--> statement-breakpoint
ALTER TABLE `import_source` ADD `enable_banking_identification_hash` text;--> statement-breakpoint
ALTER TABLE `import_source` ADD `enable_banking_session_id` text REFERENCES enable_banking_session(id);--> statement-breakpoint
ALTER TABLE `import_source` ADD `last_sync_at` integer;--> statement-breakpoint
ALTER TABLE `import_source` ADD `last_sync_error` text;--> statement-breakpoint
CREATE INDEX `importSource_connectionType_idx` ON `import_source` (`connection_type`);--> statement-breakpoint
CREATE INDEX `importSource_enableBankingSessionId_idx` ON `import_source` (`enable_banking_session_id`);