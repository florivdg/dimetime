CREATE TABLE `bank_transaction_split` (
	`id` text PRIMARY KEY NOT NULL,
	`bank_transaction_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`label` text,
	`budget_id` text,
	`plan_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`budget_id`) REFERENCES `planned_transaction`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `bankTransactionSplit_bankTransactionId_idx` ON `bank_transaction_split` (`bank_transaction_id`);--> statement-breakpoint
CREATE INDEX `bankTransactionSplit_budgetId_idx` ON `bank_transaction_split` (`budget_id`);--> statement-breakpoint
CREATE INDEX `bankTransactionSplit_planId_idx` ON `bank_transaction_split` (`plan_id`);--> statement-breakpoint
ALTER TABLE `bank_transaction` ADD `pre_split_budget_id` text REFERENCES planned_transaction(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `bank_transaction` ADD `is_split` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `bankTransaction_preSplitBudgetId_idx` ON `bank_transaction` (`pre_split_budget_id`);--> statement-breakpoint
CREATE INDEX `bankTransaction_isSplit_idx` ON `bank_transaction` (`is_split`);
