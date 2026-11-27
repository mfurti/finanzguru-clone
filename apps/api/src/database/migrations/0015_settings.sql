CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_seen_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`user_agent` text,
	CONSTRAINT "session_user_agent_len" CHECK("session"."user_agent" IS NULL OR length("session"."user_agent") <= 200)
);
--> statement-breakpoint
ALTER TABLE `account` ADD `archived_at` text;