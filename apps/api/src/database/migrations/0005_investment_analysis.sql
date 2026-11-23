CREATE TABLE `custom_group` (
	`id` text PRIMARY KEY NOT NULL,
	`grouping_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`grouping_id`) REFERENCES `custom_grouping`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "custom_group_name_len" CHECK(length("custom_group"."name") BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_group_name_unique` ON `custom_group` (`grouping_id`,`name`);--> statement-breakpoint
CREATE TABLE `custom_group_member` (
	`grouping_id` text NOT NULL,
	`group_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	PRIMARY KEY(`grouping_id`, `instrument_id`),
	FOREIGN KEY (`grouping_id`) REFERENCES `custom_grouping`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `custom_group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `custom_grouping` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	CONSTRAINT "custom_grouping_name_len" CHECK(length("custom_grouping"."name") BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_grouping_name_unique` ON `custom_grouping` (`name`);--> statement-breakpoint
CREATE TABLE `exemption_order` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`year` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institution`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "exemption_order_amount" CHECK("exemption_order"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exemption_order_institution_year` ON `exemption_order` (`institution_id`,`year`);--> statement-breakpoint
CREATE TABLE `expected_dividend` (
	`id` text PRIMARY KEY NOT NULL,
	`instrument_id` text NOT NULL,
	`pay_date` text NOT NULL,
	`ex_date` text,
	`amount_per_share` text NOT NULL,
	`note` text,
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "expected_dividend_ex_before_pay" CHECK("expected_dividend"."ex_date" IS NULL OR "expected_dividend"."ex_date" <= "expected_dividend"."pay_date"),
	CONSTRAINT "expected_dividend_amount_positive" CHECK(CAST("expected_dividend"."amount_per_share" AS REAL) > 0),
	CONSTRAINT "expected_dividend_note_len" CHECK("expected_dividend"."note" IS NULL OR length("expected_dividend"."note") <= 200)
);
--> statement-breakpoint
CREATE INDEX `expected_dividend_pay_date_idx` ON `expected_dividend` (`pay_date`);--> statement-breakpoint
CREATE TABLE `inflation_rate` (
	`year` integer PRIMARY KEY NOT NULL,
	`rate` text NOT NULL,
	CONSTRAINT "inflation_rate_year" CHECK("inflation_rate"."year" BETWEEN 1990 AND 2100),
	CONSTRAINT "inflation_rate_range" CHECK(CAST("inflation_rate"."rate" AS REAL) >= -0.1 AND CAST("inflation_rate"."rate" AS REAL) <= 0.5)
);
--> statement-breakpoint
CREATE TABLE `instrument_weight` (
	`instrument_id` text NOT NULL,
	`dimension` text NOT NULL,
	`key` text NOT NULL,
	`weight` text NOT NULL,
	PRIMARY KEY(`instrument_id`, `dimension`, `key`),
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "instrument_weight_dimension" CHECK(dimension IN ('region', 'sector', 'currency')),
	CONSTRAINT "instrument_weight_range" CHECK(CAST("instrument_weight"."weight" AS REAL) > 0 AND CAST("instrument_weight"."weight" AS REAL) <= 1)
);
--> statement-breakpoint
CREATE TABLE `tax_year` (
	`year` integer PRIMARY KEY NOT NULL,
	`assessment` text DEFAULT 'single' NOT NULL,
	`base_rate` text,
	CONSTRAINT "tax_year_assessment" CHECK(assessment IN ('single', 'joint')),
	CONSTRAINT "tax_year_base_rate" CHECK("tax_year"."base_rate" IS NULL OR (CAST("tax_year"."base_rate" AS REAL) >= 0 AND CAST("tax_year"."base_rate" AS REAL) <= 0.2))
);
--> statement-breakpoint
CREATE TABLE `user_setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `watchlist` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "watchlist_name_len" CHECK(length("watchlist"."name") BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watchlist_name_unique` ON `watchlist` (`name`);--> statement-breakpoint
CREATE TABLE `watchlist_entry` (
	`watchlist_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`added_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`watchlist_id`, `instrument_id`),
	FOREIGN KEY (`watchlist_id`) REFERENCES `watchlist`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Hand-written instead of drizzle-kit's table rebuild: the migrator runs in a
-- transaction where PRAGMA foreign_keys cannot be switched off, so DROP TABLE
-- would cascade-delete prices and lots. ADD COLUMN keeps all rows.
ALTER TABLE `instrument` ADD `fund_type` text CONSTRAINT "instrument_fund_type" CHECK("fund_type" IS NULL OR fund_type IN ('equity', 'mixed', 'other'));--> statement-breakpoint
ALTER TABLE `instrument` ADD `is_benchmark` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `instrument` SET `fund_type` = 'equity' WHERE `asset_class` IN ('etf', 'fund');
