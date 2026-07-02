import type { WatchProviderAvailability, WatchProviderType } from '@/types/movie';

const typeLabels: Record<WatchProviderType, string> = {
  flatrate: 'Abo',
  free: 'Kostenlos',
  ads: 'Mit Werbung',
  rent: 'Leihen',
  buy: 'Kaufen',
};

export function formatWatchProviders(providers: WatchProviderAvailability[] = []) {
  return providers.map((provider) => ({
    ...provider,
    label: `${provider.provider_name} · ${typeLabels[provider.type]}`,
  }));
}
