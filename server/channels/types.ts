/**
 * Interface comum de canal de anúncio. Toda integração (Meta, Google, TikTok)
 * implementa este contrato. O Dispatcher e o Collector só falam com a interface.
 */
export type Channel = "meta" | "google" | "tiktok" | "linkedin" | "mock";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface MetricsRow {
  date: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  spendCents: number;
  revenueCents: number;
}

export interface CampaignInput {
  name: string;
  objetivo?: string;
  budgetDailyCents: number;
}

export interface CreativeInput {
  imageUrl?: string | null;
  copy?: string | null;
  ratio?: string;
}

export interface AdChannelProvider {
  channel: Channel;
  // OAuth
  getAuthUrl(orgId: number): string;
  exchangeCode(code: string): Promise<TokenSet>;
  refresh(token: TokenSet): Promise<TokenSet>;
  // Operações
  createCampaign(acc: AccountRef, input: CampaignInput): Promise<{ externalRef: string }>;
  uploadCreative(acc: AccountRef, creative: CreativeInput): Promise<{ externalRef: string }>;
  createAd(acc: AccountRef, input: { campaignRef: string; creativeRef: string }): Promise<{ externalRef: string }>;
  setBudget(acc: AccountRef, ref: string, dailyBudgetCents: number): Promise<void>;
  pause(acc: AccountRef, ref: string): Promise<void>;
  resume(acc: AccountRef, ref: string): Promise<void>;
  fetchMetrics(acc: AccountRef, ref: string, range: { from: string; to: string }): Promise<MetricsRow[]>;
}

export interface AccountRef {
  organizationId: number;
  externalAccountId?: string | null;
  accessToken?: string | null;
}
