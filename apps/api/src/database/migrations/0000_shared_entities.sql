CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`iban` text,
	`parent_account_id` text,
	`source_id` text,
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`last_synced_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institution`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `data_source`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "account_name_len" CHECK(length("account"."name") BETWEEN 1 AND 80),
	CONSTRAINT "account_type" CHECK(type IN ('depot', 'checking', 'savings', 'reference', 'credit_card', 'cash'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_iban_unique` ON `account` (`iban`);--> statement-breakpoint
CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`color` text DEFAULT 'neutral' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`parent_key` text GENERATED ALWAYS AS (coalesce(parent_id, '')) VIRTUAL,
	FOREIGN KEY (`parent_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "category_kind" CHECK(kind IN ('income', 'expense', 'savings', 'transfer'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_parent_name_unique` ON `category` (`parent_key`,`name`);--> statement-breakpoint
CREATE TABLE `data_source` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`display_name` text NOT NULL,
	`encrypted_credentials` blob,
	`tool_manifest` text,
	`last_sync_at` text,
	`last_error` text,
	CONSTRAINT "data_source_kind" CHECK(kind IN ('csv', 'scalable_mcp', 'sparkasse_fints')),
	CONSTRAINT "data_source_status" CHECK(status IN ('active', 'needs_reauth', 'error', 'planned', 'disabled'))
);
--> statement-breakpoint
CREATE TABLE `institution` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bic` text,
	`logo_key` text,
	CONSTRAINT "institution_bic_len" CHECK("institution"."bic" IS NULL OR length("institution"."bic") IN (8, 11))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `institution_name_unique` ON `institution` (`name`);--> statement-breakpoint
CREATE TABLE `instrument` (
	`id` text PRIMARY KEY NOT NULL,
	`isin` text NOT NULL,
	`wkn` text,
	`name` text NOT NULL,
	`asset_class` text NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	CONSTRAINT "instrument_isin_len" CHECK(length("instrument"."isin") = 12),
	CONSTRAINT "instrument_wkn_len" CHECK("instrument"."wkn" IS NULL OR length("instrument"."wkn") = 6),
	CONSTRAINT "instrument_asset_class" CHECK(asset_class IN ('stock', 'etf', 'fund', 'bond', 'crypto', 'commodity', 'other')),
	CONSTRAINT "instrument_currency_len" CHECK(length("instrument"."currency") = 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instrument_isin_unique` ON `instrument` (`isin`);--> statement-breakpoint
CREATE TABLE `net_worth_snapshot` (
	`account_id` text NOT NULL,
	`date` text NOT NULL,
	`value_cents` integer NOT NULL,
	`invested_cents` integer NOT NULL,
	`external_flow_cents` integer DEFAULT 0 NOT NULL,
	`price_stale` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`account_id`, `date`),
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `owner` (
	`id` text PRIMARY KEY DEFAULT 'owner' NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`inflation_rate` text DEFAULT '0.0253' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "owner_single_row" CHECK("owner"."id" = 'owner'),
	CONSTRAINT "owner_display_name_len" CHECK(length("owner"."display_name") BETWEEN 1 AND 60),
	CONSTRAINT "owner_inflation_range" CHECK(CAST("owner"."inflation_rate" AS REAL) >= 0 AND CAST("owner"."inflation_rate" AS REAL) <= 0.5)
);
--> statement-breakpoint
CREATE TABLE `position_lot` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	`open_date` text NOT NULL,
	`quantity_open` text NOT NULL,
	`cost_per_unit` text NOT NULL,
	`closed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "position_lot_quantity_non_negative" CHECK(CAST("position_lot"."quantity_open" AS REAL) >= 0)
);
--> statement-breakpoint
CREATE INDEX `position_lot_account_instrument_idx` ON `position_lot` (`account_id`,`instrument_id`);--> statement-breakpoint
CREATE TABLE `price` (
	`instrument_id` text NOT NULL,
	`date` text NOT NULL,
	`close` text NOT NULL,
	`source` text NOT NULL,
	PRIMARY KEY(`instrument_id`, `date`),
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "price_close_positive" CHECK(CAST("price"."close" AS REAL) > 0),
	CONSTRAINT "price_source" CHECK(source IN ('scalable', 'csv', 'manual'))
);
--> statement-breakpoint
CREATE TABLE `transactions` (
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
	CONSTRAINT "transactions_source" CHECK(source IN ('csv', 'scalable_mcp', 'manual')),
	CONSTRAINT "transactions_category_source" CHECK("transactions"."category_source" IS NULL OR category_source IN ('manual', 'rule', 'import')),
	CONSTRAINT "transactions_instrument_required" CHECK("transactions"."type" NOT IN ('buy', 'sell', 'dividend', 'split') OR "transactions"."instrument_id" IS NOT NULL),
	CONSTRAINT "transactions_quantity_required" CHECK("transactions"."type" NOT IN ('buy', 'sell', 'split') OR "transactions"."quantity" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_fingerprint_unique` ON `transactions` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `transactions_account_booking_idx` ON `transactions` (`account_id`,`booking_date`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_source_ref_unique` ON `transactions` (`source`,`source_ref`);