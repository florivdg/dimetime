CREATE TABLE `kassensturz_dismissal` (
	`id` text PRIMARY KEY NOT NULL,
	`bank_transaction_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`reason` text,
	`dismissed_at` integer NOT NULL,
	`dismissed_by_user_id` text,
	FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dismissed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kassensturzDismissal_bankTx_plan_idx` ON `kassensturz_dismissal` (`bank_transaction_id`,`plan_id`);--> statement-breakpoint
CREATE INDEX `kassensturzDismissal_planId_idx` ON `kassensturz_dismissal` (`plan_id`);--> statement-breakpoint
CREATE TABLE `kassensturz_manual_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`amount_cents` integer NOT NULL,
	`type` text DEFAULT 'expense' NOT NULL,
	`planned_transaction_id` text,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planned_transaction_id`) REFERENCES `planned_transaction`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `kassensturzManualEntry_planId_idx` ON `kassensturz_manual_entry` (`plan_id`);--> statement-breakpoint
CREATE INDEX `kassensturzManualEntry_plannedTransactionId_idx` ON `kassensturz_manual_entry` (`planned_transaction_id`);--> statement-breakpoint
DROP INDEX `transactionReconciliation_plannedTransactionId_idx`;--> statement-breakpoint
CREATE INDEX `transactionReconciliation_plannedTransactionId_idx` ON `transaction_reconciliation` (`planned_transaction_id`);