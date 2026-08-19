CREATE TABLE `installment_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`amount` integer NOT NULL,
	`total_installments` integer NOT NULL,
	`prepaid_installments` integer DEFAULT 0 NOT NULL,
	`start_month` text NOT NULL,
	`day_of_month` integer,
	`category_id` text,
	`user_id` text NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `installmentPlan_userId_idx` ON `installment_plan` (`user_id`);--> statement-breakpoint
CREATE INDEX `installmentPlan_startMonth_idx` ON `installment_plan` (`start_month`);--> statement-breakpoint
CREATE INDEX `installmentPlan_categoryId_idx` ON `installment_plan` (`category_id`);--> statement-breakpoint
CREATE TABLE `installment_skip` (
	`id` text PRIMARY KEY NOT NULL,
	`installment_id` text NOT NULL,
	`month` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`installment_id`) REFERENCES `installment_plan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `installmentSkip_installmentId_month_idx` ON `installment_skip` (`installment_id`,`month`);--> statement-breakpoint
ALTER TABLE `planned_transaction` ADD `installment_id` text REFERENCES installment_plan(id);--> statement-breakpoint
CREATE INDEX `plannedTransaction_installmentId_idx` ON `planned_transaction` (`installment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `plannedTransaction_planId_installmentId_idx` ON `planned_transaction` (`plan_id`,`installment_id`);