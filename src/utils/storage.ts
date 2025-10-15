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

import { STORAGE_KEYS } from '../types';

export class Storage {
  private static isQuotaError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorMessage.includes('QUOTA_BYTES') ||
           errorMessage.includes('QuotaExceededError') ||
           errorMessage.includes('quota');
  }

  private static logStorageError(operation: string, error: unknown): void {
    console.error(`[Storage] Error during ${operation}:`, error);
  }

  static async getCustomFilters(): Promise<string[]> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_FILTERS);
      return result[STORAGE_KEYS.CUSTOM_FILTERS] || [];
    } catch (error) {
      this.logStorageError('getCustomFilters', error);
      // Fallback to local storage
      try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.CUSTOM_FILTERS);
        return result[STORAGE_KEYS.CUSTOM_FILTERS] || [];
      } catch (localError) {
        this.logStorageError('getCustomFilters (local fallback)', localError);
        return [];
      }
    }
  }

  static async setCustomFilters(filters: string[]): Promise<void> {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_FILTERS]: filters });
    } catch (error) {
      this.logStorageError('setCustomFilters', error);

      if (this.isQuotaError(error)) {
        console.warn('[Storage] Quota exceeded, falling back to local storage');
        try {
          await chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_FILTERS]: filters });
        } catch (localError) {
          this.logStorageError('setCustomFilters (local fallback)', localError);
          throw new Error('Failed to save filters: Storage quota exceeded and local storage also failed');
        }
      } else {
        throw error;
      }
    }
  }

  static async getCustomFiltersText(): Promise<string> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_FILTERS_TEXT);
      return result[STORAGE_KEYS.CUSTOM_FILTERS_TEXT] || '';
    } catch (error) {
      this.logStorageError('getCustomFiltersText', error);
      // Fallback to local storage
      try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.CUSTOM_FILTERS_TEXT);
        return result[STORAGE_KEYS.CUSTOM_FILTERS_TEXT] || '';
      } catch (localError) {
        this.logStorageError('getCustomFiltersText (local fallback)', localError);
        return '';
      }
    }
  }

  static async setCustomFiltersText(text: string): Promise<void> {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_FILTERS_TEXT]: text });
    } catch (error) {
      this.logStorageError('setCustomFiltersText', error);

      if (this.isQuotaError(error)) {
        console.warn('[Storage] Quota exceeded, falling back to local storage');
        try {
          await chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_FILTERS_TEXT]: text });
        } catch (localError) {
          this.logStorageError('setCustomFiltersText (local fallback)', localError);
          throw new Error('Failed to save filter text: Storage quota exceeded and local storage also failed');
        }
      } else {
        throw error;
      }
    }
  }

  static async addCustomFilter(filter: string): Promise<void> {
    try {
      const filters = await this.getCustomFilters();
      if (!filters.includes(filter.toLowerCase())) {
        filters.push(filter.toLowerCase());
        await this.setCustomFilters(filters);
      }
    } catch (error) {
      this.logStorageError('addCustomFilter', error);
      throw error;
    }
  }

  static async removeCustomFilter(filter: string): Promise<void> {
    try {
      const filters = await this.getCustomFilters();
      const updated = filters.filter(f => f !== filter.toLowerCase());
      await this.setCustomFilters(updated);
    } catch (error) {
      this.logStorageError('removeCustomFilter', error);
      throw error;
    }
  }

  static async getAllFilters(): Promise<string[]> {
    return await this.getCustomFilters();
  }

  static async isEnabled(): Promise<boolean> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.ENABLED);
      // Default to enabled if not set
      return result[STORAGE_KEYS.ENABLED] !== false;
    } catch (error) {
      this.logStorageError('isEnabled', error);
      // Fallback to local storage
      try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.ENABLED);
        return result[STORAGE_KEYS.ENABLED] !== false;
      } catch (localError) {
        this.logStorageError('isEnabled (local fallback)', localError);
        // Default to enabled on error
        return true;
      }
    }
  }

  static async setEnabled(enabled: boolean): Promise<void> {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEYS.ENABLED]: enabled });
    } catch (error) {
      this.logStorageError('setEnabled', error);

      if (this.isQuotaError(error)) {
        console.warn('[Storage] Quota exceeded, falling back to local storage');
        try {
          await chrome.storage.local.set({ [STORAGE_KEYS.ENABLED]: enabled });
        } catch (localError) {
          this.logStorageError('setEnabled (local fallback)', localError);
          throw new Error('Failed to save enabled state: Storage quota exceeded and local storage also failed');
        }
      } else {
        throw error;
      }
    }
  }
}
