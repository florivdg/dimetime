CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`color` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `category_name_idx` ON `category` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `category_slug_idx` ON `category` (`slug`);--> statement-breakpoint
CREATE TABLE `plan` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`date` text NOT NULL,
	`notes` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plan_date_idx` ON `plan` (`date`);--> statement-breakpoint
CREATE TABLE `planned_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`type` text DEFAULT 'expense' NOT NULL,
	`due_date` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`is_done` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`plan_id` text,
	`user_id` text,
	`category_id` text,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `plannedTransaction_planId_idx` ON `planned_transaction` (`plan_id`);--> statement-breakpoint
CREATE INDEX `plannedTransaction_userId_idx` ON `planned_transaction` (`user_id`);--> statement-breakpoint
CREATE INDEX `plannedTransaction_dueDate_idx` ON `planned_transaction` (`due_date`);--> statement-breakpoint
CREATE INDEX `plannedTransaction_categoryId_idx` ON `planned_transaction` (`category_id`);--> statement-breakpoint
CREATE INDEX `plannedTransaction_type_idx` ON `planned_transaction` (`type`);