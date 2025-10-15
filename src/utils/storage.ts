import { STORAGE_KEYS, FilterData } from '../types';

export class Storage {
  static async getCustomFilters(): Promise<string[]> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_FILTERS);
    return result[STORAGE_KEYS.CUSTOM_FILTERS] || [];
  }

  static async setCustomFilters(filters: string[]): Promise<void> {
    await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_FILTERS]: filters });
  }

  static async getCustomFiltersText(): Promise<string> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_FILTERS_TEXT);
    return result[STORAGE_KEYS.CUSTOM_FILTERS_TEXT] || '';
  }

  static async setCustomFiltersText(text: string): Promise<void> {
    await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_FILTERS_TEXT]: text });
  }

  static async addCustomFilter(filter: string): Promise<void> {
    const filters = await this.getCustomFilters();
    if (!filters.includes(filter.toLowerCase())) {
      filters.push(filter.toLowerCase());
      await this.setCustomFilters(filters);
    }
  }

  static async removeCustomFilter(filter: string): Promise<void> {
    const filters = await this.getCustomFilters();
    const updated = filters.filter(f => f !== filter.toLowerCase());
    await this.setCustomFilters(updated);
  }

  static async getAllFilters(): Promise<string[]> {
    return await this.getCustomFilters();
  }
}
