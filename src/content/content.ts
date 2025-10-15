import { Storage } from '../utils/storage';

class YouTubeFilter {
  private filters: string[] = [];
  private observer: MutationObserver | null = null;
  private processedVideos = new Set<string>();

  async init() {
    await this.loadFilters();
    this.startObserving();
    this.filterExistingVideos();

    // Listen for filter updates from popup
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.customFilters || changes.defaultFiltersEnabled) {
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
    // Create unique ID for this video element
    const videoId = this.getVideoId(element);
    if (!videoId) {
      return;
    }

    const title = this.getVideoTitle(element);
    if (!title) {
      return;
    }

    if (this.shouldFilter(title)) {
      // Always hide matching videos, even if we've seen this video ID before
      // (YouTube can show the same video in multiple places/pages)
      this.hideVideo(element);

      // Only increment counter if this is the first time we've blocked this video
      if (!this.processedVideos.has(videoId)) {
        this.processedVideos.add(videoId);
        Storage.incrementBlockedCount();
      }
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

  private shouldFilter(title: string): boolean {
    const lowerTitle = title.toLowerCase();
    return this.filters.some(filter => {
      const lowerFilter = filter.toLowerCase();
      return lowerTitle.includes(lowerFilter);
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
