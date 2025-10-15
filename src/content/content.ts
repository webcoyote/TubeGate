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
      'ytd-video-renderer',              // Home feed (desktop)
      'ytd-grid-video-renderer',         // Grid view (desktop)
      'ytd-rich-item-renderer',          // Rich grid (new home desktop)
      'ytd-compact-video-renderer',      // Sidebar (desktop)
      'ytm-shorts-lockup-view-model',    // Shorts (mobile/desktop)
      'ytd-reel-item-renderer'           // Shorts shelf (desktop)
    ];

    selectors.forEach(selector => {
      const videos = document.querySelectorAll(selector);
      videos.forEach(video => this.processVideo(video as HTMLElement));
    });
  }

  private processVideo(element: HTMLElement) {
    const videoId = this.getVideoId(element);
    if (!videoId) {
      return;
    }

    const title = this.getVideoTitle(element);
    if (!title) {
      return;
    }

    const channelName = this.getChannelName(element);
    if (this.shouldFilter(title, channelName)) {
      console.log('[YT Filter] Blocked:', title, channelName ? `(${channelName})` : '');
      this.hideVideo(element);
    } else {
      console.debug('[YT Filter] Shown:', title, channelName ? `(${channelName})` : '');
    }
  }

  private getVideoId(element: HTMLElement): string | null {
    // Try multiple link selectors (regular videos and Shorts)
    const linkSelectors = [
      'a#video-title',
      'a#thumbnail',
      'a[href^="/shorts/"]',
      'a.shortsLockupViewModelHostEndpoint'
    ];

    for (const selector of linkSelectors) {
      const link = element.querySelector(selector);
      if (link instanceof HTMLAnchorElement) {
        return link.href;
      }
    }

    return null;
  }

  private getVideoTitle(element: HTMLElement): string | null {
    // Strategy 1: Try specific title selectors
    const titleSelectors = [
      '#video-title',                              // Standard video title
      'a#video-title-link',                        // Some grid views
      '.title',                                    // Generic title class
      'h3 a',                                      // Title in heading
      'a.shortsLockupViewModelHostEndpoint',       // Shorts link (contains title/aria-label)
      '.shortsLockupViewModelHostMetadataTitle a'  // Shorts title metadata
    ];

    for (const selector of titleSelectors) {
      const titleElement = element.querySelector(selector);
      if (titleElement) {
        const title = titleElement.getAttribute('title') ||
                     titleElement.getAttribute('aria-label') ||
                     titleElement.textContent?.trim();
        if (title && title.length > 0) {
          return title;
        }
      }
    }

    // Strategy 2: For Shorts, look for span with role="text" inside title area
    const shortsSpan = element.querySelector('.shortsLockupViewModelHostMetadataTitle span[role="text"]');
    if (shortsSpan) {
      const title = shortsSpan.textContent?.trim();
      if (title && title.length > 0) {
        return title;
      }
    }

    // Strategy 3: Fallback - search for any link with title or aria-label
    const links = element.querySelectorAll('a');
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const title = link.getAttribute('title') || link.getAttribute('aria-label');
      if (title && title.length > 10) { // Reasonable title length
        return title;
      }
    }

    return null;
  }

  private getChannelName(element: HTMLElement): string | null {
    // Strategy 1: Try channel name selectors
    const channelSelectors = [
      'ytd-channel-name #text',                    // Standard channel name
      '#channel-name #text',                       // Alternative channel name
      'a.yt-simple-endpoint[href^="/@"]',          // Channel link
      'a.yt-simple-endpoint[href*="/channel/"]',   // Channel page link
      '#channel-title',                            // Compact video renderer
    ];

    for (const selector of channelSelectors) {
      const channelElement = element.querySelector(selector);
      if (channelElement) {
        const channelName = channelElement.textContent?.trim();
        if (channelName && channelName.length > 0) {
          return channelName;
        }
      }
    }

    // Strategy 2: Look for any link to a channel
    const channelLinks = element.querySelectorAll('a[href^="/@"], a[href*="/channel/"]');
    for (let i = 0; i < channelLinks.length; i++) {
      const link = channelLinks[i];
      const channelName = link.textContent?.trim();
      // Make sure it's not too long (probably not a channel name)
      if (channelName && channelName.length > 0 && channelName.length < 100) {
        return channelName;
      }
    }

    return null;
  }

  private shouldFilter(title: string, channelName: string | null): boolean {
    const lowerTitle = title.toLowerCase();
    const lowerChannel = channelName?.toLowerCase() || '';

    return this.filters.some(filter => {
      const lowerFilter = filter.toLowerCase();
      // Check if filter matches title or channel name
      return lowerTitle.includes(lowerFilter) || lowerChannel.includes(lowerFilter);
    });
  }

  private hideVideo(element: HTMLElement) {
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
