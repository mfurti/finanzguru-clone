CREATE TABLE `instrument_value_snapshot` (
	`account_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	`date` text NOT NULL,
	`value_cents` integer NOT NULL,
	`invested_cents` integer NOT NULL,
	PRIMARY KEY(`account_id`, `instrument_id`, `date`),
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `instrument_value_snapshot_instrument_date_idx` ON `instrument_value_snapshot` (`instrument_id`,`date`);--> statement-breakpoint
CREATE TABLE `sync_run` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`imported` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`error` text,
	FOREIGN KEY (`source_id`) REFERENCES `data_source`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sync_run_status" CHECK(status IN ('running', 'succeeded', 'partial', 'failed')),
	CONSTRAINT "sync_run_counts" CHECK("sync_run"."imported" >= 0 AND "sync_run"."skipped" >= 0),
	CONSTRAINT "sync_run_error_len" CHECK("sync_run"."error" IS NULL OR length("sync_run"."error") <= 500)
);
--> statement-breakpoint
CREATE INDEX `sync_run_source_started_idx` ON `sync_run` (`source_id`,`started_at`);