CREATE TABLE `recipient_logo` (
	`recipient_key` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`brand_slug` text,
	`file_name` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "recipient_logo_key_len" CHECK(length("recipient_logo"."recipient_key") BETWEEN 1 AND 200),
	CONSTRAINT "recipient_logo_mode" CHECK(mode IN ('brand', 'none', 'upload')),
	CONSTRAINT "recipient_logo_brand" CHECK(("recipient_logo"."mode" = 'brand') = ("recipient_logo"."brand_slug" IS NOT NULL)),
	CONSTRAINT "recipient_logo_file" CHECK(("recipient_logo"."mode" = 'upload') = ("recipient_logo"."file_name" IS NOT NULL))
);
