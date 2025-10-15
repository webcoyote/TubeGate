export interface FilterData {
  customFilters: string[];
  defaultFiltersEnabled: boolean;
  statistics: {
    blockedToday: number;
    lastResetDate: string;
  };
}

export interface StorageKeys {
  CUSTOM_FILTERS: 'customFilters';
  DEFAULT_FILTERS_ENABLED: 'defaultFiltersEnabled';
  STATISTICS: 'statistics';
}

export const STORAGE_KEYS: StorageKeys = {
  CUSTOM_FILTERS: 'customFilters',
  DEFAULT_FILTERS_ENABLED: 'defaultFiltersEnabled',
  STATISTICS: 'statistics'
};

export const DEFAULT_FILTERS = [
  'politics',
  'election',
  'trump',
  'biden',
  'congress',
  'senator',
  'political'
];
