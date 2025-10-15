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

import { Storage } from '../utils/storage';

class PopupController {
  private filtersTextarea: HTMLTextAreaElement;
  private saveFiltersBtn: HTMLElement;
  private filterCountEl: HTMLElement;
  private feedbackBtn: HTMLElement;

  constructor() {
    this.filtersTextarea = document.getElementById('filtersTextarea') as HTMLTextAreaElement;
    this.saveFiltersBtn = document.getElementById('saveFiltersBtn')!;
    this.filterCountEl = document.getElementById('filterCount')!;
    this.feedbackBtn = document.getElementById('feedbackBtn')!;

    this.init();
  }

  private async init() {
    this.setupEventListeners();
    await this.loadData();
  }

  private setupEventListeners() {
    // Save filters
    this.saveFiltersBtn.addEventListener('click', () => this.saveFilters());

    // Feedback
    this.feedbackBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://github.com/webcoyote/TubeGate/issues' });
    });
  }

  private async loadData() {
    // Load custom filters into textarea
    await this.loadFiltersToTextarea();

    // Update filter count
    await this.updateFilterCount();
  }

  private async loadFiltersToTextarea() {
    // Load the raw text if it exists, otherwise fall back to filters array
    let text = await Storage.getCustomFiltersText();

    if (!text) {
      // Migration: if we only have the old format, convert it
      const filters = await Storage.getCustomFilters();
      text = filters.join('\n');
      if (text) {
        await Storage.setCustomFiltersText(text);
      }
    }

    // If still empty, provide default suggestions
    if (!text || text.trim() === '') {
      text = `# Welcome to TubeGate!
# Add keywords to filter (one per line, or separated by commas)
# Lines starting with # are comments and will be ignored

# Here are some suggestions (uncomment to activate):
# MLB, NBA, NFL, golf

# Remove ads
sponsored
`;
      await Storage.setCustomFiltersText(text);
    }

    this.filtersTextarea.value = text;
  }

  private parseFiltersFromText(text: string): string[] {
    const filters: string[] = [];

    // Split by newlines first
    const lines = text.split('\n');

    for (const line of lines) {
      // Remove comments (everything after #)
      const withoutComments = line.split('#')[0];

      // Split by commas
      const parts = withoutComments.split(/[,]/);

      for (const part of parts) {
        const trimmed = part.trim().toLowerCase();
        if (trimmed && !filters.includes(trimmed)) {
          filters.push(trimmed);
        }
      }
    }

    return filters;
  }

  private async saveFilters() {
    const text = this.filtersTextarea.value;
    const filters = this.parseFiltersFromText(text);

    // Save both the raw text (for display) and parsed filters (for filtering)
    await Storage.setCustomFiltersText(text);
    await Storage.setCustomFilters(filters);
    await this.updateFilterCount();

    // Show brief confirmation
    this.saveFiltersBtn.textContent = 'Saved!';
    setTimeout(() => {
      this.saveFiltersBtn.textContent = 'Save Filters';
    }, 1500);
  }

  private async updateFilterCount() {
    const allFilters = await Storage.getAllFilters();
    console.log('[YT Filter] Filters:', allFilters);
    const count = allFilters.length;
    this.filterCountEl.textContent = `${count} active ${count === 1 ? 'filter' : 'filters'}`;
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
