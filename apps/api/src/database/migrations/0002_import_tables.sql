CREATE TABLE `categorization_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`priority` integer NOT NULL,
	`match_field` text NOT NULL,
	`operator` text NOT NULL,
	`pattern` text NOT NULL,
	`amount_sign` text,
	`category_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "categorization_rule_match_field" CHECK(match_field IN ('counterparty', 'purpose', 'counterparty_iban')),
	CONSTRAINT "categorization_rule_operator" CHECK(operator IN ('contains', 'equals', 'starts_with', 'regex')),
	CONSTRAINT "categorization_rule_amount_sign" CHECK("categorization_rule"."amount_sign" IS NULL OR amount_sign IN ('positive', 'negative')),
	CONSTRAINT "categorization_rule_pattern_len" CHECK(length("categorization_rule"."pattern") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categorization_rule_priority_unique` ON `categorization_rule` (`priority`);--> statement-breakpoint
CREATE TABLE `csv_mapping` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`header_signature` text NOT NULL,
	`delimiter` text NOT NULL,
	`encoding` text NOT NULL,
	`date_format` text NOT NULL,
	`decimal_separator` text NOT NULL,
	`skip_rows` integer DEFAULT 0 NOT NULL,
	`columns` text NOT NULL,
	`default_account_id` text,
	FOREIGN KEY (`default_account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `csv_mapping_header_signature_unique` ON `csv_mapping` (`header_signature`);--> statement-breakpoint
CREATE TABLE `import_job` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`kind` text NOT NULL,
	`file_name` text,
	`file_sha256` text,
	`format` text,
	`account_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`imported` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`errors` text DEFAULT '[]' NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`source_id`) REFERENCES `data_source`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "import_job_kind" CHECK(kind IN ('csv_upload', 'sync')),
	CONSTRAINT "import_job_status" CHECK(status IN ('pending', 'running', 'succeeded', 'partial', 'failed'))
);
