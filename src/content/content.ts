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
import { InlineFilterPanel } from './inline-panel';

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
  private enabled: boolean = true;
  private selectorConfigs: SelectorConfig[] = [];
  private inlinePanel: InlineFilterPanel = new InlineFilterPanel();

  async init() {
    try {
      // Wait for document.body to exist if running at document_start
      if (!document.body) {
        await new Promise(resolve => {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
          } else {
            resolve(null);
          }
        });
      }

      this.initializeSelectors();
      await this.loadFilters();
      await this.loadEnabledState();
      this.startObserving();
      this.filterExistingVideos();

      // Listen for filter updates from popup or inline panel
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.customFilters || changes.enabled !== undefined) {
          this.loadFilters()
            .then(() => this.loadEnabledState())
            .then(() => {
              this.unblockAll();
              if (this.enabled) {
                this.filterExistingVideos();
              }
            })
            .catch(error => {
              console.error('[YT Filter] Failed to reload:', error);
            });
        }
      });

      // Inject inline filter panel into YouTube sidebar
      this.inlinePanel.ensureInjected();

      // Handle YouTube SPA navigation
      document.addEventListener('yt-navigate-finish', () => {
        this.inlinePanel.ensureInjected();
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
      { selector: 'ytd-radio-renderer', description: 'Radio/Mix playlists', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytd-playlist-renderer', description: 'Playlists', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytd-mix-renderer', description: 'Mix recommendations', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'yt-lockup-view-model', description: 'Lockup view (watch page recommendations)', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytm-shorts-lockup-view-model', description: 'Shorts (mobile/desktop)', lastSuccessTime: 0, failureCount: 0 },
      { selector: 'ytm-shorts-lockup-view-model-v2', description: 'Shorts v2 (mobile/desktop)', lastSuccessTime: 0, failureCount: 0 },
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
    }
  }

  private startObserving() {
    this.observer = new MutationObserver((_mutations) => {
      if (this.debounceTimer !== null) {
        cancelAnimationFrame(this.debounceTimer);
      }
      this.debounceTimer = requestAnimationFrame(() => {
        this.filterExistingVideos();
        this.debounceTimer = null;
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private filterExistingVideos() {
    if (!this.enabled) {
      return;
    }

    let totalElementsProcessed = 0;

    this.selectorConfigs.forEach(config => {
      try {
        const videos = document.querySelectorAll(config.selector);

        if (videos.length > 0) {
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
          config.failureCount++;
        }
      } catch (error) {
        console.error(`[YT Filter] Error with selector ${config.selector}:`, error);
        config.failureCount++;
      }
    });

    if (totalElementsProcessed === 0) {
      this.tryFallbackSelectors();
    }
  }

  private tryFallbackSelectors() {
    const fallbackSelectors = [
      '[id*="video-"]',
      '[class*="video-"]',
      'a[href*="/watch?v="]',
      'a[href*="/shorts/"]',
    ];

    fallbackSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          try {
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
    if (!window.location.pathname.includes('/watch')) {
      return false;
    }

    const playerContainer = element.closest('#player, #movie_player, ytd-watch-flexy #primary-inner, ytd-watch-flexy #primary, ytd-player');
    if (playerContainer) {
      return true;
    }

    const videoContainer = element.closest('ytd-player, #ytd-player, .html5-video-player');
    if (videoContainer) {
      return true;
    }

    const hasVideoPlayer = element.querySelector('video.html5-main-video, video.video-stream');
    if (hasVideoPlayer) {
      return true;
    }

    return false;
  }

  private processVideo(element: HTMLElement) {
    try {
      if (element.dataset.ytFilterProcessed === 'true') {
        return;
      }

      element.dataset.ytFilterProcessed = 'true';

      if (this.isMainVideoPlayer(element)) {
        return;
      }

      const allText = element.textContent || '';

      if (!allText.trim()) {
        return;
      }

      const matchedFilter = this.shouldFilterByText(allText);
      if (matchedFilter) {
        console.log(`[YT Filter] Blocked element containing <<${matchedFilter}>>`);
        this.blockVideo(element, matchedFilter);
      }
    } catch (error) {
      console.error('[YT Filter] Error processing video element:', error);
    }
  }

  private shouldFilterByText(text: string): string | null {
    const lowerText = text.toLowerCase();

    for (const filter of this.filters) {
      if (lowerText.includes(filter)) {
        return filter;
      }
    }

    return null;
  }

  private findThumbnailElement(element: HTMLElement): HTMLElement | null {
    const thumbnailSelectors = [
      'ytd-thumbnail',
      'yt-thumbnail',
      'ytm-thumbnail',
      'a#thumbnail',
      'div#thumbnail',
      '.shortsLockupViewModelHostThumbnailContainer',
      '.shortsLockupViewModelHostThumbnailParentContainer',
      '.media-item-thumbnail-container',
    ];

    for (const selector of thumbnailSelectors) {
      const candidates = element.querySelectorAll(selector) as NodeListOf<HTMLElement>;
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (!candidate.closest('badge-shape, yt-badge-view-model, ytd-badge-supported-renderer')) {
          return candidate;
        }
      }
    }

    // Fallback: search for elements with "thumbnail" in id/class
    const fallback = element.querySelector(
      '[id*="thumbnail"]:not([class*="badge"]), [class*="thumbnail"]:not([class*="badge"])'
    ) as HTMLElement | null;

    return fallback;
  }

  private blockVideo(element: HTMLElement, matchedFilter: string) {
    try {
      element.setAttribute('data-tubegate-blocked', 'true');

      const thumbnailElement = this.findThumbnailElement(element);
      const overlayParent = thumbnailElement || element;

      if (window.getComputedStyle(overlayParent).position === 'static') {
        overlayParent.style.position = 'relative';
      }

      const overlay = document.createElement('div');
      overlay.className = 'tubegate-overlay';
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: #f5f5f5;
        border-radius: 8px;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        pointer-events: auto;
        cursor: default;
        opacity: 0;
        transition: opacity 0.4s ease-in;
      `;

      const label = document.createElement('span');
      label.textContent = `Blocked: "${matchedFilter}"`;
      label.style.cssText = `
        font-family: "Roboto", "Arial", sans-serif;
        font-size: 11px;
        color: #909090;
        pointer-events: none;
        user-select: none;
      `;
      overlay.appendChild(label);

      overlayParent.appendChild(overlay);

      // Trigger fade-in animation (double-rAF ensures browser has painted at opacity 0)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.style.opacity = '1';
        });
      });
    } catch (error) {
      console.error('[YT Filter] Error blocking video:', error);
    }
  }

  private unblockAll() {
    document.querySelectorAll('.tubegate-overlay').forEach(el => el.remove());
    document.querySelectorAll('[data-tubegate-blocked="true"]').forEach(el => {
      el.removeAttribute('data-tubegate-blocked');
    });
    document.querySelectorAll('[data-yt-filter-processed="true"]').forEach(el => {
      el.removeAttribute('data-yt-filter-processed');
    });
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.unblockAll();
    this.inlinePanel.destroy();
  }
}

// Initialize the filter
const filter = new YouTubeFilter();
filter.init();
