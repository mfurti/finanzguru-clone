CREATE TABLE `dashboard_layout` (
	`widget_key` text PRIMARY KEY NOT NULL,
	`position` integer NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	CONSTRAINT "dashboard_layout_widget_key" CHECK(widget_key IN ('networth', 'allocation', 'kpis', 'holdings', 'accounts', 'review', 'cashflow', 'budgets'))
);
