/**
 * MockProvider — implementação de canal para desenvolvimento, sem gastar dinheiro
 * nem depender de aprovação de API. Gera refs falsas e métricas plausíveis
 * (determinísticas por ref) para o motor (A/Z + redistribuição) ser testado ponta a ponta.
 */
import type { AdChannelProvider, AccountRef, CampaignInput, CreativeInput, MetricsRow } from "./types";

let counter = 1000;
function ref(prefix: string): string {
  counter += 1;
  return `mock_${prefix}_${counter}`;
}

// hash simples e estável para variar métricas por ref
function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export const MockProvider: AdChannelProvider = {
  channel: "mock",

  getAuthUrl() {
    return "/app/integracoes?mock=connected";
  },
  async exchangeCode() {
    return { accessToken: "mock-access-token", refreshToken: "mock-refresh", expiresAt: new Date(Date.now() + 3600e3) };
  },
  async refresh() {
    return { accessToken: "mock-access-token", expiresAt: new Date(Date.now() + 3600e3) };
  },

  async createCampaign(_acc: AccountRef, _input: CampaignInput) {
    return { externalRef: ref("camp") };
  },
  async uploadCreative(_acc: AccountRef, _creative: CreativeInput) {
    return { externalRef: ref("crea") };
  },
  async createAd(_acc: AccountRef, _input) {
    return { externalRef: ref("ad") };
  },
  async setBudget() {},
  async pause() {},
  async resume() {},

  async fetchMetrics(_acc: AccountRef, refStr: string, range): Promise<MetricsRow[]> {
    const s = seed(refStr);
    // "qualidade" estável por ref → algumas variantes vendem mais (ovos de ouro)
    const quality = (s % 100) / 100; // 0..1
    const days = enumerateDays(range.from, range.to);
    return days.map((date, i) => {
      const daySeed = seed(refStr + date);
      const impressions = 800 + (daySeed % 1200);
      const ctr = 0.01 + quality * 0.04; // 1%..5%
      const clicks = Math.round(impressions * ctr);
      const convRate = 0.005 + quality * quality * 0.035; // 0,5%..4% (quadrático separa melhor os vencedores)
      const conversions = Math.round(clicks * convRate);
      const leads = Math.round(clicks * (0.15 + quality * 0.25));
      const cpcCents = 80 + (daySeed % 120); // R$0,80–2,00
      const spendCents = clicks * cpcCents;
      const ticketCents = 29700; // R$297
      const revenueCents = conversions * ticketCents;
      return { date, impressions, clicks, leads, conversions, spendCents, revenueCents };
    });
  },
};

function enumerateDays(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  for (let d = start; d <= end; d = new Date(d.getTime() + 86400e3)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out.length ? out : [from];
}
