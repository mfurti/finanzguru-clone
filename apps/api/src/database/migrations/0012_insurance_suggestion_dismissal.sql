CREATE TABLE `insurance_suggestion_dismissal` (
	`key` text PRIMARY KEY NOT NULL,
	`dismissed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "insurance_dismissal_key_len" CHECK(length("insurance_suggestion_dismissal"."key") BETWEEN 1 AND 200)
);
