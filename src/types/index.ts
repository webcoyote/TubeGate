export interface FilterData {
  customFilters: string[];
  customFiltersText: string;
}

export interface StorageKeys {
  CUSTOM_FILTERS: 'customFilters';
  CUSTOM_FILTERS_TEXT: 'customFiltersText';
}

export const STORAGE_KEYS: StorageKeys = {
  CUSTOM_FILTERS: 'customFilters',
  CUSTOM_FILTERS_TEXT: 'customFiltersText'
};
