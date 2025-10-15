export interface FilterData {
  customFilters: string[];
  statistics: {
    blockedToday: number;
    shownToday: number;
    lastResetDate: string;
  };
}

export interface StorageKeys {
  CUSTOM_FILTERS: 'customFilters';
  STATISTICS: 'statistics';
}

export const STORAGE_KEYS: StorageKeys = {
  CUSTOM_FILTERS: 'customFilters',
  STATISTICS: 'statistics'
};
