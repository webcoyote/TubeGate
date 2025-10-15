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

interface SelectorConfig {
  selector: string;
  description: string;
  lastSuccessTime: number;
  failureCount: number;
}

class YouTubeFilter {
  private filters: Set<string> = new Set();
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private readonly DEBOUNCE_DELAY = 100; // milliseconds
  private enabled: boolean = true;
  private selectorConfigs: SelectorConfig[] = [];
  private readonly MAX_SELECTOR_FAILURES = 10;
  private lastHealthCheck: number = 0;
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute

  async init() {
    try {
      this.initializeSelectors();
      await this.loadFilters();
      await this.loadEnabledState();
      this.startObserving();
      this.filterExistingVideos();

      // Listen for filter updates from popup
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.customFilters) {
          this.loadFilters().catch(error => {
            console.error('[YT Filter] Failed to reload filters:', error);
          });
          this.filterExistingVideos();
        }
        if (changes.enabled !== undefined) {
          this.loadEnabledState().catch(error => {
            console.error('[YT Filter] Failed to reload enabled state:', error);
          });
          this.filterExistingVideos();
        }
      });
    } catch (error) {
      console.error('[YT Filter] Failed to initialize:', error);
    }
  }

  private initializeSelectors() {
    // Primary selectors - current YouTube structure (2025)
    this.selectorConfigs = [
      { selector: 'ytd-video-renderer', description: 'Home feed (desktop)', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytd-grid-video-renderer', description: 'Grid view (desktop)', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytd-rich-item-renderer', description: 'Rich grid (new home desktop)', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytd-compact-video-renderer', description: 'Sidebar (desktop)', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytm-shorts-lockup-view-model', description: 'Shorts (mobile/desktop)', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytd-reel-item-renderer', description: 'Shorts shelf (desktop)', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytd-ad-slot-renderer', description: 'Ad slot containers', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytd-in-feed-ad-layout-renderer', description: 'In-feed ads', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytd-display-ad-renderer', description: 'Display ads', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytd-promoted-sparkles-web-renderer', description: 'Promoted content', lastSuccessTime: 0, failureCount: 0 },
    ];
  }

  private async loadEnabledState() {
    try {
      this.enabled = await Storage.isEnabled();
    } catch (error) {
      console.error('[YT Filter] Failed to load enabled state:', error);
      // Default to enabled on error
      this.enabled = true;
    }
  }

  private async loadFilters() {
    try {
      const filterArray = await Storage.getAllFilters();
      // Store filters as lowercase in a Set for O(1) lookups
      this.filters = new Set(filterArray.map(f => f.toLowerCase()));
    } catch (error) {
      console.error('[YT Filter] Failed to load filters:', error);
      // Keep existing filters on error
    }
  }

  private startObserving() {
    this.observer = new MutationObserver((_mutations) => {
      // Debounce the filtering to avoid excessive processing
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = window.setTimeout(() => {
        this.filterExistingVideos();
        this.debounceTimer = null;
      }, this.DEBOUNCE_DELAY);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private filterExistingVideos() {
    // Don't filter if disabled
    if (!this.enabled) {
      return;
    }

    let totalElementsProcessed = 0;

    // Try each selector and track success/failure
    this.selectorConfigs.forEach(config => {
      try {
        const videos = document.querySelectorAll(config.selector);

        if (videos.length > 0) {
          // Selector is working - update success time and reset failures
          config.lastSuccessTime = Date.now();
          config.failureCount = 0;
          totalElementsProcessed += videos.length;

          videos.forEach(video => {
            try {
              this.processVideo(video as HTMLElement);
            } catch (error) {
              console.error(`[YT Filter] Error processing video with selector ${config.selector}:`, error);
            }
          });
        } else {
          // No elements found - increment failure count
          config.failureCount++;
        }
      } catch (error) {
        console.error(`[YT Filter] Error with selector ${config.selector}:`, error);
        config.failureCount++;
      }
    });

    // Fallback: try generic video-like patterns if no selectors worked
    if (totalElementsProcessed === 0) {
      this.tryFallbackSelectors();
    }
  }

  private tryFallbackSelectors() {
    // Generic fallback patterns that might catch new YouTube structures
    const fallbackSelectors = [
      '[id*="video-"]',           // Elements with video in ID
      '[class*="video-"]',        // Elements with video in class
      'a[href*="/watch?v="]',     // Video links
      'a[href*="/shorts/"]',      // Shorts links
    ];

    fallbackSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          try {
            // Process parent containers that might contain video info
            const container = element.closest('[id], [class]') as HTMLElement;
            if (container && container.textContent) {
              this.processVideo(container);
            }
          } catch {
            // Silent fail for fallback attempts
          }
        });
      } catch {
        // Silent fail for fallback attempts
      }
    });
  }

  private isMainVideoPlayer(element: HTMLElement): boolean {
    // Check if we're on a watch page
    if (!window.location.pathname.includes('/watch')) {
      return false;
    }

    // Check if element is within the primary video player container
    // YouTube's watch page has the main video in #player or #primary-inner
    const playerContainer = element.closest('#player, #movie_player, ytd-watch-flexy #primary-inner');
    if (playerContainer) {
      // Additional check: main video is typically in the top portion and has specific classes
      const videoContainer = element.closest('ytd-player, #ytd-player');
      if (videoContainer) {
        return true;
      }
    }

    return false;
  }

  private processVideo(element: HTMLElement) {
    try {
      // Skip if already processed
      if (element.dataset.ytFilterProcessed === 'true') {
        return;
      }

      // Mark as processed to avoid reprocessing
      element.dataset.ytFilterProcessed = 'true';

      // Don't filter the main video player on watch pages
      if (this.isMainVideoPlayer(element)) {
        return;
      }

      // Get all text content from the element and its children
      const allText = element.textContent || '';

      // Skip if no text content
      if (!allText.trim()) {
        return;
      }

      // Check if any filter matches any text in the element
      const matchedFilter = this.shouldFilterByText(allText);
      if (matchedFilter) {
        console.log(`[YT Filter] Blocked element containing <<${matchedFilter}>>`);
        this.removeVideo(element);
      }
    } catch (error) {
      console.error('[YT Filter] Error processing video element:', error);
    }
  }

  private shouldFilterByText(text: string): string | null {
    const lowerText = text.toLowerCase();

    // Filters are already stored as lowercase in the Set
    for (const filter of this.filters) {
      if (lowerText.includes(filter)) {
        return filter;
      }
    }

    return null;
  }

  private removeVideo(element: HTMLElement) {
    try {
      // Try common parent containers in order of preference
      const parentSelectors = [
        'ytd-rich-item-renderer',      // New grid layout
        'ytd-video-renderer',           // Feed layout
        'ytd-grid-video-renderer',      // Grid layout
        'ytd-compact-video-renderer',   // Sidebar
        'ytd-reel-item-renderer',       // Shorts
      ];

      // Try to find and remove the appropriate parent container
      for (const selector of parentSelectors) {
        const parent = element.closest(selector);
        if (parent) {
          parent.remove();
          return;
        }
      }

      // Fallback: try to find any container element with video-related attributes
      const container = element.closest('[id*="video"], [class*="video"], [id*="content"], [class*="item"]');
      if (container && container !== element) {
        container.remove();
        return;
      }

      // Last resort: remove the element itself
      element.remove();
    } catch (error) {
      console.error('[YT Filter] Error removing video element:', error);
      // Try basic removal as absolute fallback
      try {
        element.style.display = 'none';
      } catch (hideError) {
        console.error('[YT Filter] Could not hide element:', hideError);
      }
    }
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
