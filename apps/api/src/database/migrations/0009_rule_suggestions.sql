CREATE TABLE `rule_suggestion` (
	`id` text PRIMARY KEY NOT NULL,
	`counterparty_key` text NOT NULL,
	`category_id` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rule_suggestion_key_len" CHECK(length("rule_suggestion"."counterparty_key") BETWEEN 1 AND 200),
	CONSTRAINT "rule_suggestion_count" CHECK("rule_suggestion"."count" >= 0),
	CONSTRAINT "rule_suggestion_status" CHECK(status IN ('open', 'accepted', 'declined'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rule_suggestion_pair_idx` ON `rule_suggestion` (`counterparty_key`,`category_id`);