CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`ownerId` int NOT NULL,
	`plan` enum('free','starter','pro') NOT NULL DEFAULT 'free',
	`pagarmeCustomerId` varchar(255),
	`pagarmeSubscriptionId` varchar(255),
	`planExpiresAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','superadmin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `calibration_logs` ADD `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `creatives` ADD `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `dispatch_logs` ADD `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `integrations` ADD `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `password` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `organizationId` int;