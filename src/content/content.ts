import { Storage } from '../utils/storage';

class YouTubeFilter {
  private filters: string[] = [];
  private observer: MutationObserver | null = null;
  private processedVideos = new Set<string>();

  async init() {
    console.log('YouTube Filter: Initializing...');
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
    console.log('YouTube Filter: Loaded filters:', this.filters);
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
      'ytd-video-renderer',           // Home feed
      'ytd-grid-video-renderer',      // Grid view
      'ytd-rich-item-renderer',       // Rich grid (new home)
      'ytd-compact-video-renderer'    // Sidebar
    ];

    selectors.forEach(selector => {
      const videos = document.querySelectorAll(selector);
      videos.forEach(video => this.processVideo(video as HTMLElement));
    });
  }

  private processVideo(element: HTMLElement) {
    // Create unique ID for this video element
    const videoId = this.getVideoId(element);
    if (!videoId || this.processedVideos.has(videoId)) {
      return;
    }

    const title = this.getVideoTitle(element);
    if (!title) {
      return;
    }

    if (this.shouldFilter(title)) {
      console.log('YouTube Filter: Hiding video:', title);
      this.hideVideo(element);
      this.processedVideos.add(videoId);
      Storage.incrementBlockedCount();
    } else {
      console.debug('YouTube Filter: Showing video:', title);
    }
  }

  private getVideoId(element: HTMLElement): string | null {
    // Try to get the video link
    const link = element.querySelector('a#video-title, a#thumbnail');
    if (link instanceof HTMLAnchorElement) {
      return link.href;
    }
    return null;
  }

  private getVideoTitle(element: HTMLElement): string | null {
    // Multiple possible title selectors
    const titleSelectors = [
      '#video-title',
      'h3 a',
      'a#video-title-link',
      '.title'
    ];

    for (const selector of titleSelectors) {
      const titleElement = element.querySelector(selector);
      if (titleElement) {
        const title = titleElement.textContent?.trim() ||
                     titleElement.getAttribute('title') ||
                     titleElement.getAttribute('aria-label');
        if (title) {
          return title;
        }
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
    // Instead of removing, hide with CSS to avoid breaking layout
    element.style.display = 'none';
    element.setAttribute('data-yt-filter-hidden', 'true');
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
