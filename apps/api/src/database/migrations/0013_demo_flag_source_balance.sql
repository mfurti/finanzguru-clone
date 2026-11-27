ALTER TABLE `account` ADD `source_balance_cents` integer;--> statement-breakpoint
ALTER TABLE `account` ADD `source_balance_date` text;--> statement-breakpoint
ALTER TABLE `institution` ADD `is_demo` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `institution` SET `is_demo` = 1 WHERE `name` IN ('Demo Broker', 'Demo Bank');
