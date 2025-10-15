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

class YouTubeFilter {
  private filters: string[] = [];
  private observer: MutationObserver | null = null;

  async init() {
    await this.loadFilters();
    this.startObserving();
    this.filterExistingVideos();

    // Listen for filter updates from popup
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.customFilters) {
        this.loadFilters();
        this.filterExistingVideos();
      }
    });
  }

  private async loadFilters() {
    this.filters = await Storage.getAllFilters();
  }

  private startObserving() {
    this.observer = new MutationObserver((mutations) => {
      this.filterExistingVideos();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private filterExistingVideos() {
    // YouTube uses different selectors for different pages
    const selectors = [
      'ytd-video-renderer',                  // Home feed (desktop)
      'ytd-grid-video-renderer',             // Grid view (desktop)
      'ytd-rich-item-renderer',              // Rich grid (new home desktop)
      'ytd-compact-video-renderer',          // Sidebar (desktop)
      'ytm-shorts-lockup-view-model',        // Shorts (mobile/desktop)
      'ytd-reel-item-renderer',              // Shorts shelf (desktop)
      'ytd-ad-slot-renderer',                // Ad slot containers
      'ytd-in-feed-ad-layout-renderer',      // In-feed ads
      'ytd-display-ad-renderer',             // Display ads
      'ytd-promoted-sparkles-web-renderer',  // Promoted content
    ];

    selectors.forEach(selector => {
      const videos = document.querySelectorAll(selector);
      videos.forEach(video => this.processVideo(video as HTMLElement));
    });

  }

  private processVideo(element: HTMLElement) {
    // Get all text content from the element and its children
    const allText = element.textContent || '';

    // Check if any filter matches any text in the element
    const matchedFilter = this.shouldFilterByText(allText);
    if (matchedFilter) {
      console.log(`[YT Filter] Blocked element containing <<${matchedFilter}>>`);
      this.removeVideo(element);
    }
  }

  private shouldFilterByText(text: string): string | null {
    const lowerText = text.toLowerCase();

    for (const filter of this.filters) {
      const lowerFilter = filter.toLowerCase();
      if (lowerText.includes(lowerFilter)) {
        return filter;
      }
    }

    return null;
  }

  private removeVideo(element: HTMLElement) {
    // For grid layouts, we need to remove the parent container
    // ytd-rich-item-renderer is the parent for new YouTube layout
    const richItemParent = element.closest('ytd-rich-item-renderer');
    if (richItemParent) {
      richItemParent.remove();
      return;
    }

    // For other layouts, remove the element itself
    element.remove();
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Initialize the filter
const filter = new YouTubeFilter();
filter.init();
