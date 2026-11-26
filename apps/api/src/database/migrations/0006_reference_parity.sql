CREATE TABLE `deleted_import_marker` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`fingerprint` text NOT NULL,
	`source_ref` text,
	`deleted_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deleted_import_marker_unique` ON `deleted_import_marker` (`source`,`fingerprint`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'neutral' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "tag_name_len" CHECK(length("tag"."name") BETWEEN 1 AND 40)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_name_lower_unique` ON `tag` (lower("name"));--> statement-breakpoint
CREATE TABLE `transaction_tag` (
	`transaction_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`transaction_id`, `tag_id`),
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transaction_tag_tag_idx` ON `transaction_tag` (`tag_id`);--> statement-breakpoint
ALTER TABLE `category` ADD `icon` text DEFAULT 'tag' NOT NULL;--> statement-breakpoint
CREATE INDEX `transactions_booking_id_idx` ON `transactions` (`booking_date`,`id`);