CREATE TABLE `bank_consent` (
	`source_id` text PRIMARY KEY NOT NULL,
	`aspsp_name` text NOT NULL,
	`aspsp_country` text NOT NULL,
	`valid_until` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `data_source`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bank_consent_country" CHECK(length("bank_consent"."aspsp_country") = 2)
);
--> statement-breakpoint
CREATE TABLE `quote` (
	`instrument_id` text PRIMARY KEY NOT NULL,
	`price` text NOT NULL,
	`change_abs` text,
	`change_pct` text,
	`quoted_at` text NOT NULL,
	`fetched_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "quote_price_positive" CHECK(CAST("quote"."price" AS REAL) > 0)
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_data_source` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`display_name` text NOT NULL,
	`encrypted_credentials` blob,
	`tool_manifest` text,
	`last_sync_at` text,
	`last_error` text,
	CONSTRAINT "data_source_kind" CHECK(kind IN ('csv', 'scalable_mcp', 'sparkasse_fints', 'enable_banking')),
	CONSTRAINT "data_source_status" CHECK(status IN ('active', 'needs_reauth', 'error', 'planned', 'disabled', 'consent_expired'))
);
--> statement-breakpoint
INSERT INTO `__new_data_source`("id", "kind", "status", "display_name", "encrypted_credentials", "tool_manifest", "last_sync_at", "last_error") SELECT "id", "kind", "status", "display_name", "encrypted_credentials", "tool_manifest", "last_sync_at", "last_error" FROM `data_source`;--> statement-breakpoint
DROP TABLE `data_source`;--> statement-breakpoint
ALTER TABLE `__new_data_source` RENAME TO `data_source`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`booking_date` text NOT NULL,
	`value_date` text,
	`amount_cents` integer NOT NULL,
	`type` text NOT NULL,
	`counterparty` text,
	`counterparty_iban` text,
	`purpose` text,
	`instrument_id` text,
	`quantity` text,
	`unit_price` text,
	`fee_cents` integer DEFAULT 0 NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`category_id` text,
	`category_source` text,
	`review_status` text DEFAULT 'unreviewed' NOT NULL,
	`source` text NOT NULL,
	`source_ref` text,
	`fingerprint` text NOT NULL,
	`import_job_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transactions_type" CHECK(type IN ('income', 'expense', 'transfer', 'buy', 'sell', 'dividend', 'interest', 'tax', 'fee', 'split', 'deposit', 'withdrawal')),
	CONSTRAINT "transactions_review_status" CHECK(review_status IN ('unreviewed', 'reviewed')),
	CONSTRAINT "transactions_source" CHECK(source IN ('csv', 'scalable_mcp', 'manual', 'enable_banking')),
	CONSTRAINT "transactions_category_source" CHECK("__new_transactions"."category_source" IS NULL OR category_source IN ('manual', 'rule', 'import')),
	CONSTRAINT "transactions_instrument_required" CHECK("__new_transactions"."type" NOT IN ('buy', 'sell', 'dividend', 'split') OR "__new_transactions"."instrument_id" IS NOT NULL),
	CONSTRAINT "transactions_quantity_required" CHECK("__new_transactions"."type" NOT IN ('buy', 'sell', 'split') OR "__new_transactions"."quantity" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "account_id", "booking_date", "value_date", "amount_cents", "type", "counterparty", "counterparty_iban", "purpose", "instrument_id", "quantity", "unit_price", "fee_cents", "tax_cents", "category_id", "category_source", "review_status", "source", "source_ref", "fingerprint", "import_job_id", "created_at") SELECT "id", "account_id", "booking_date", "value_date", "amount_cents", "type", "counterparty", "counterparty_iban", "purpose", "instrument_id", "quantity", "unit_price", "fee_cents", "tax_cents", "category_id", "category_source", "review_status", "source", "source_ref", "fingerprint", "import_job_id", "created_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_fingerprint_unique` ON `transactions` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `transactions_account_booking_idx` ON `transactions` (`account_id`,`booking_date`);--> statement-breakpoint
CREATE INDEX `transactions_booking_id_idx` ON `transactions` (`booking_date`,`id`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_source_ref_unique` ON `transactions` (`source`,`source_ref`);--> statement-breakpoint
ALTER TABLE `instrument_value_snapshot` ADD `flow_cents` integer DEFAULT 0 NOT NULL;