CREATE TABLE `calibration_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`userId` int NOT NULL,
	`analysis` text NOT NULL,
	`suggestions` json NOT NULL,
	`status` enum('pendente','aplicado','ignorado') NOT NULL DEFAULT 'pendente',
	`appliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calibration_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`objective` varchar(128) NOT NULL,
	`targetAudience` text,
	`budgetTotal` decimal(12,2) NOT NULL,
	`budgetSpent` decimal(12,2) DEFAULT '0',
	`channels` json NOT NULL,
	`status` enum('rascunho','ativa','pausada','concluida','arquivada') NOT NULL DEFAULT 'rascunho',
	`startDate` timestamp,
	`endDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `creatives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int,
	`userId` int NOT NULL,
	`briefing` text NOT NULL,
	`imageUrl` text,
	`imageKey` text,
	`status` enum('gerando','aprovado','rejeitado','em_uso') NOT NULL DEFAULT 'gerando',
	`channels` json,
	`usageCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creatives_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dispatch_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`creativeId` int,
	`channel` varchar(64) NOT NULL,
	`status` enum('agendado','enviado','falhou','cancelado') NOT NULL DEFAULT 'agendado',
	`scheduledAt` timestamp NOT NULL,
	`executedAt` timestamp,
	`errorMessage` text,
	`externalId` varchar(255),
	`payload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dispatch_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`channel` enum('linkedin','tiktok','instagram','google') NOT NULL,
	`accountName` varchar(255),
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` timestamp,
	`status` enum('conectado','desconectado','erro') NOT NULL DEFAULT 'desconectado',
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`channel` varchar(64) NOT NULL,
	`date` timestamp NOT NULL,
	`impressions` int DEFAULT 0,
	`clicks` int DEFAULT 0,
	`conversions` int DEFAULT 0,
	`spend` decimal(12,2) DEFAULT '0',
	`revenue` decimal(12,2) DEFAULT '0',
	`roi` decimal(8,4) DEFAULT '0',
	`ctr` decimal(8,4) DEFAULT '0',
	`cpc` decimal(8,4) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `metrics_id` PRIMARY KEY(`id`)
);
