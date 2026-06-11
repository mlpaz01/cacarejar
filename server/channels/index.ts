/** Registry de providers de canal. getProvider() resolve a implementação. */
import type { AdChannelProvider, Channel } from "./types";
import { MockProvider } from "./mock";

const registry: Partial<Record<Channel, AdChannelProvider>> = {
  mock: MockProvider,
  // meta: MetaProvider,   (Sprint 4)
  // google: GoogleProvider,
  // tiktok: TikTokProvider,
};

export function getProvider(channel: Channel): AdChannelProvider {
  return registry[channel] ?? MockProvider;
}

export * from "./types";
