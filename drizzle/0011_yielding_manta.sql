ALTER TABLE `bank_transaction` ADD `is_archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `bankTransaction_isArchived_idx` ON `bank_transaction` (`is_archived`);