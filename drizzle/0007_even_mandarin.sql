CREATE TABLE `bank_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`first_seen_import_id` text,
	`last_seen_import_id` text,
	`external_transaction_id` text,
	`dedupe_key` text NOT NULL,
	`booking_date` text NOT NULL,
	`value_date` text,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`original_amount_cents` integer,
	`original_currency` text,
	`counterparty` text,
	`booking_text` text,
	`description` text,
	`purpose` text,
	`status` text DEFAULT 'unknown' NOT NULL,
	`balance_after_cents` integer,
	`balance_currency` text,
	`country` text,
	`card_last4` text,
	`cardholder` text,
	`raw_data_json` text NOT NULL,
	`plan_id` text,
	`plan_assignment` text DEFAULT 'none' NOT NULL,
	`import_seen_count` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `import_source`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`first_seen_import_id`) REFERENCES `statement_import`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`last_seen_import_id`) REFERENCES `statement_import`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bankTransaction_sourceId_dedupeKey_idx` ON `bank_transaction` (`source_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `bankTransaction_bookingDate_idx` ON `bank_transaction` (`booking_date`);--> statement-breakpoint
CREATE INDEX `bankTransaction_planId_idx` ON `bank_transaction` (`plan_id`);--> statement-breakpoint
CREATE INDEX `bankTransaction_status_idx` ON `bank_transaction` (`status`);--> statement-breakpoint
CREATE INDEX `bankTransaction_externalTransactionId_idx` ON `bank_transaction` (`external_transaction_id`);--> statement-breakpoint
CREATE TABLE `import_source` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`preset` text NOT NULL,
	`source_kind` text NOT NULL,
	`bank_name` text,
	`account_label` text,
	`account_identifier` text,
	`default_plan_assignment` text DEFAULT 'auto_month' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `importSource_preset_idx` ON `import_source` (`preset`);--> statement-breakpoint
CREATE INDEX `importSource_isActive_idx` ON `import_source` (`is_active`);--> statement-breakpoint
CREATE TABLE `statement_import` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_sha256` text NOT NULL,
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
CREATE INDEX `statementImport_sourceId_idx` ON `statement_import` (`source_id`);--> statement-breakpoint
CREATE INDEX `statementImport_fileSha256_idx` ON `statement_import` (`file_sha256`);--> statement-breakpoint
CREATE INDEX `statementImport_createdAt_idx` ON `statement_import` (`created_at`);--> statement-breakpoint
CREATE TABLE `transaction_reconciliation` (
	`id` text PRIMARY KEY NOT NULL,
	`bank_transaction_id` text NOT NULL,
	`planned_transaction_id` text NOT NULL,
	`match_type` text DEFAULT 'manual' NOT NULL,
	`confidence` integer,
	`matched_at` integer NOT NULL,
	`matched_by_user_id` text,
	FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planned_transaction_id`) REFERENCES `planned_transaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`matched_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactionReconciliation_bankTransactionId_idx` ON `transaction_reconciliation` (`bank_transaction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactionReconciliation_plannedTransactionId_idx` ON `transaction_reconciliation` (`planned_transaction_id`);