CREATE TABLE `kassensturz_match_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`direction` text NOT NULL,
	`merchant_fingerprint` text NOT NULL,
	`target_planned_name_normalized` text NOT NULL,
	`target_category_id` text,
	`avg_amount_cents` integer NOT NULL,
	`amount_tolerance_cents` integer NOT NULL,
	`confirm_count` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `import_source`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kassensturzMatchRule_source_fingerprint_target_idx` ON `kassensturz_match_rule` (`source_id`,`direction`,`merchant_fingerprint`,`target_planned_name_normalized`);--> statement-breakpoint
CREATE INDEX `kassensturzMatchRule_lookup_idx` ON `kassensturz_match_rule` (`source_id`,`direction`,`merchant_fingerprint`,`active`);--> statement-breakpoint
CREATE INDEX `kassensturzMatchRule_targetName_idx` ON `kassensturz_match_rule` (`target_planned_name_normalized`);--> statement-breakpoint
CREATE INDEX `kassensturzMatchRule_category_idx` ON `kassensturz_match_rule` (`target_category_id`);