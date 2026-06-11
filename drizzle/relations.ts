import { relations } from "drizzle-orm";
import {
  organizations,
  users,
  campaigns,
  creatives,
  metrics,
  integrations,
  dispatchLogs,
  calibrationLogs,
} from "./schema";

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  owner: one(users, { fields: [organizations.ownerId], references: [users.id] }),
  campaigns: many(campaigns),
  creatives: many(creatives),
  integrations: many(integrations),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [campaigns.organizationId],
    references: [organizations.id],
  }),
  creatives: many(creatives),
  metrics: many(metrics),
  calibrationLogs: many(calibrationLogs),
  dispatchLogs: many(dispatchLogs),
}));

export const creativesRelations = relations(creatives, ({ one }) => ({
  organization: one(organizations, {
    fields: [creatives.organizationId],
    references: [organizations.id],
  }),
  campaign: one(campaigns, {
    fields: [creatives.campaignId],
    references: [campaigns.id],
  }),
}));

export const metricsRelations = relations(metrics, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [metrics.campaignId],
    references: [campaigns.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrations.organizationId],
    references: [organizations.id],
  }),
}));

export const dispatchLogsRelations = relations(dispatchLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [dispatchLogs.organizationId],
    references: [organizations.id],
  }),
  campaign: one(campaigns, {
    fields: [dispatchLogs.campaignId],
    references: [campaigns.id],
  }),
}));

export const calibrationLogsRelations = relations(calibrationLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [calibrationLogs.organizationId],
    references: [organizations.id],
  }),
  campaign: one(campaigns, {
    fields: [calibrationLogs.campaignId],
    references: [campaigns.id],
  }),
}));
