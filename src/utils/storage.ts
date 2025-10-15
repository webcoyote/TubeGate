/**
 * TubeGate - YouTube Content Filter Extension
 * Copyright 2025 Patrick Wyatt
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
