CREATE TABLE `transaction_preset` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`type` text DEFAULT 'expense' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`recurrence` text DEFAULT 'einmalig' NOT NULL,
	`end_date` text,
	`user_id` text NOT NULL,
	`category_id` text,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `transactionPreset_userId_idx` ON `transaction_preset` (`user_id`);--> statement-breakpoint
CREATE INDEX `transactionPreset_categoryId_idx` ON `transaction_preset` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactionPreset_type_idx` ON `transaction_preset` (`type`);--> statement-breakpoint
CREATE INDEX `transactionPreset_recurrence_idx` ON `transaction_preset` (`recurrence`);