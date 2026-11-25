PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transactions_type" CHECK(type IN ('income', 'expense', 'transfer', 'buy', 'sell', 'dividend', 'interest', 'tax', 'fee', 'split', 'deposit', 'withdrawal')),
	CONSTRAINT "transactions_review_status" CHECK(review_status IN ('unreviewed', 'reviewed')),
	CONSTRAINT "transactions_note_len" CHECK("__new_transactions"."note" IS NULL OR length("__new_transactions"."note") <= 1000),
	CONSTRAINT "transactions_source" CHECK(source IN ('csv', 'scalable_mcp', 'manual', 'enable_banking')),
	CONSTRAINT "transactions_category_source" CHECK("__new_transactions"."category_source" IS NULL OR category_source IN ('manual', 'rule', 'import')),
	CONSTRAINT "transactions_instrument_required" CHECK("__new_transactions"."type" NOT IN ('buy', 'sell', 'dividend', 'split') OR "__new_transactions"."instrument_id" IS NOT NULL),
	CONSTRAINT "transactions_quantity_required" CHECK("__new_transactions"."type" NOT IN ('buy', 'sell', 'split') OR "__new_transactions"."quantity" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "account_id", "booking_date", "value_date", "amount_cents", "type", "counterparty", "counterparty_iban", "purpose", "instrument_id", "quantity", "unit_price", "fee_cents", "tax_cents", "category_id", "category_source", "review_status", "source", "source_ref", "fingerprint", "import_job_id", "created_at") SELECT "id", "account_id", "booking_date", "value_date", "amount_cents", "type", "counterparty", "counterparty_iban", "purpose", "instrument_id", "quantity", "unit_price", "fee_cents", "tax_cents", "category_id", "category_source", "review_status", "source", "source_ref", "fingerprint", "import_job_id", "created_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_fingerprint_unique` ON `transactions` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `transactions_account_booking_idx` ON `transactions` (`account_id`,`booking_date`);--> statement-breakpoint
CREATE INDEX `transactions_booking_id_idx` ON `transactions` (`booking_date`,`id`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_source_ref_unique` ON `transactions` (`source`,`source_ref`);