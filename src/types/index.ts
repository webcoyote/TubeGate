export interface FilterData {
  customFilters: string[];
  customFiltersText: string;
  statistics: {
    blockedToday: number;
    shownToday: number;
    lastResetDate: string;
  };
}

export interface StorageKeys {
  CUSTOM_FILTERS: 'customFilters';
  CUSTOM_FILTERS_TEXT: 'customFiltersText';
  STATISTICS: 'statistics';
}

export const STORAGE_KEYS: StorageKeys = {
  CUSTOM_FILTERS: 'customFilters',
  CUSTOM_FILTERS_TEXT: 'customFiltersText',
  STATISTICS: 'statistics'
};
