import { STORAGE_KEYS, FilterData } from '../types';

export class Storage {
  static async getCustomFilters(): Promise<string[]> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_FILTERS);
    return result[STORAGE_KEYS.CUSTOM_FILTERS] || [];
  }

  static async setCustomFilters(filters: string[]): Promise<void> {
    await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_FILTERS]: filters });
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

  static async getStatistics(): Promise<FilterData['statistics']> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.STATISTICS);
    return result[STORAGE_KEYS.STATISTICS] || {
      blockedToday: 0,
      lastResetDate: new Date().toDateString()
    };
  }

  static async setStatistics(stats: FilterData['statistics']): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.STATISTICS]: stats });
  }

  static async incrementBlockedCount(): Promise<void> {
    const stats = await this.getStatistics();
    const today = new Date().toDateString();

    if (stats.lastResetDate !== today) {
      stats.blockedToday = 1;
      stats.lastResetDate = today;
    } else {
      stats.blockedToday += 1;
    }

    await this.setStatistics(stats);
  }

  static async getAllFilters(): Promise<string[]> {
    return await this.getCustomFilters();
  }
}
