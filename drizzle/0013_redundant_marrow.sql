ALTER TABLE `bank_transaction` ADD `budget_id` text REFERENCES planned_transaction(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `bankTransaction_budgetId_idx` ON `bank_transaction` (`budget_id`);--> statement-breakpoint
ALTER TABLE `planned_transaction` ADD `is_budget` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `transaction_preset` ADD `is_budget` integer DEFAULT false NOT NULL;
