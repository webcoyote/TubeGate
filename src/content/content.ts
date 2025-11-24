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
  private enabled: boolean = true;
  private selectorConfigs: SelectorConfig[] = [];
  private lastHealthCheck: number = 0;

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

      // Inject CSS to disable inline playback on blocked videos
      this.injectDisablePlaybackCSS();

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

  private injectDisablePlaybackCSS() {
    const style = document.createElement('style');
    style.id = 'tubegate-disable-playback';
    style.textContent = `
      /* Disable inline playback on blocked videos */
      [data-tubegate-blocked="true"] ytd-thumbnail video,
      [data-tubegate-blocked="true"] yt-thumbnail video,
      [data-tubegate-blocked="true"] ytm-thumbnail video,
      [data-tubegate-blocked="true"] ytd-moving-thumbnail-renderer,
      [data-tubegate-blocked="true"] ytd-thumbnail-overlay-playback-status-renderer {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Prevent hover effects on blocked video thumbnails */
      [data-tubegate-blocked="true"]:hover ytd-thumbnail,
      [data-tubegate-blocked="true"]:hover yt-thumbnail,
      [data-tubegate-blocked="true"]:hover ytm-thumbnail {
        cursor: default !important;
      }

      /* Disable any inline playback containers */
      [data-tubegate-blocked="true"] [data-inline-playback],
      [data-inline-playback-disabled="true"] {
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
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
      // Use requestAnimationFrame to sync with browser render cycle
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
    const playerContainer = element.closest('#player, #movie_player, ytd-watch-flexy #primary-inner, ytd-watch-flexy #primary, ytd-player');
    if (playerContainer) {
      return true;
    }

    // Additional check: element is within the main video container
    const videoContainer = element.closest('ytd-player, #ytd-player, .html5-video-player');
    if (videoContainer) {
      return true;
    }

    // Check if this element is a parent/ancestor of the actual video player
    const hasVideoPlayer = element.querySelector('video.html5-main-video, video.video-stream');
    if (hasVideoPlayer) {
      return true;
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
        // Use the new method that only replaces the thumbnail
        this.replaceThumbnailOnly(element, matchedFilter);
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
        'yt-lockup-view-model',         // Watch page recommendations
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

  private replaceThumbnailOnly(element: HTMLElement, matchedFilter: string) {
    try {
      // Disable hover previews at the container level
      element.setAttribute('data-tubegate-blocked', 'true');

      // Disable YouTube's inline playback feature
      element.removeAttribute('data-inline-playback');
      element.setAttribute('data-inline-playback-disabled', 'true');

      // Find the ytd-thumbnail element specifically and disable its hover behavior
      const ytdThumbnails = element.querySelectorAll('ytd-thumbnail, yt-thumbnail, ytm-thumbnail');
      ytdThumbnails.forEach(thumb => {
        (thumb as HTMLElement).removeAttribute('data-inline-playback');
        thumb.setAttribute('data-inline-playback-disabled', 'true');
        // Disable the moving thumbnail preview feature
        const movingThumbnail = thumb.querySelector('ytd-moving-thumbnail-renderer, ytd-thumbnail-overlay-playback-status-renderer');
        if (movingThumbnail) {
          (movingThumbnail as HTMLElement).remove();
        }
      });

      // Find and disable all interactive elements within
      const allInteractiveElements = element.querySelectorAll('a, button, [role="button"], [onclick], [onmouseenter], [onmouseover]');
      allInteractiveElements.forEach(el => {
        (el as HTMLElement).style.pointerEvents = 'none';
        el.removeAttribute('onclick');
        el.removeAttribute('onmouseenter');
        el.removeAttribute('onmouseover');
        // Don't remove href as it might be used for other purposes
      });
      // Find thumbnail elements within the video container
      const thumbnailSelectors = [
        'ytd-thumbnail',
        'yt-thumbnail',
        'ytm-thumbnail',
        'a#thumbnail',
        'div#thumbnail',
        '.ytd-thumbnail',
        '.yt-thumbnail',
        '.thumbnail-container',
        '.shortsLockupViewModelHostThumbnailContainer',
        '.shortsLockupViewModelHostThumbnailParentContainer',
        '.media-item-thumbnail-container',
        '.video-thumb',
        '.ytp-cued-thumbnail-overlay-image'
      ];

      let thumbnailElement: HTMLElement | null = null;

      // Try to find the thumbnail element, but exclude badge elements
      for (const selector of thumbnailSelectors) {
        const candidates = element.querySelectorAll(selector) as NodeListOf<HTMLElement>;
        for (let i = 0; i < candidates.length; i++) {
          const candidate = candidates[i];
          // Skip if this is a badge or inside a badge
          if (!candidate.closest('badge-shape, yt-badge-view-model, ytd-badge-supported-renderer')) {
            thumbnailElement = candidate;
            break;
          }
        }
        if (thumbnailElement) break;
      }

      // If no thumbnail found within the element, check if the element itself is the thumbnail container
      if (!thumbnailElement) {
        // Check if element itself matches any thumbnail selector and is not a badge
        for (const selector of thumbnailSelectors) {
          if (element.matches(selector) && !element.closest('badge-shape, yt-badge-view-model, ytd-badge-supported-renderer')) {
            thumbnailElement = element;
            break;
          }
        }
      }

      // If still no thumbnail, look for any element with thumbnail in the class or id (but not badges)
      if (!thumbnailElement) {
        const candidates = element.querySelectorAll('[id*="thumbnail"], [class*="thumbnail"]:not(badge-shape):not([class*="badge"])') as NodeListOf<HTMLElement>;
        for (let i = 0; i < candidates.length; i++) {
          const candidate = candidates[i];
          if (!candidate.closest('badge-shape, yt-badge-view-model, ytd-badge-supported-renderer')) {
            thumbnailElement = candidate;
            break;
          }
        }
      }

      // If we couldn't find a thumbnail element, fall back to the old method
      if (!thumbnailElement) {
        console.warn('[YT Filter] Could not find thumbnail element, falling back to full replacement');
        this.replaceWithPlaceholder(element, matchedFilter);
        return;
      }

      // Find ALL image elements within the thumbnail container
      const imageSelectors = [
        'img',
        'yt-image img',
        '.yt-core-image',
        '.ytCoreImageHost',
        'img#img',
        '[role="img"]'
      ];

      // First, try to find and hide all images within the thumbnail
      for (const selector of imageSelectors) {
        const images = thumbnailElement.querySelectorAll(selector) as NodeListOf<HTMLElement>;
        if (images.length > 0) {
          images.forEach(img => {
            // Hide the image
            img.style.visibility = 'hidden';
            img.style.opacity = '0';
            // Remove src to prevent loading
            if (img instanceof HTMLImageElement) {
              img.src = '';
              img.srcset = '';
            }
          });
        }
      }

      // Also check if thumbnailElement itself is an image
      if (thumbnailElement instanceof HTMLImageElement) {
        thumbnailElement.style.visibility = 'hidden';
        thumbnailElement.style.opacity = '0';
        thumbnailElement.src = '';
        thumbnailElement.srcset = '';
      }

      // Get the computed style of the thumbnail
      const computedStyle = window.getComputedStyle(thumbnailElement);

      // Create placeholder element for just the thumbnail
      const placeholder = document.createElement('div');
      placeholder.className = 'tubegate-thumbnail-placeholder';

      // Instead of replacing, we'll overlay on top of the thumbnail
      // This ensures we don't break YouTube's layout
      placeholder.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: #f5f5f5;
        border: 1px solid #e0e0e0;
        border-radius: ${computedStyle.borderRadius || '8px'};
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
        font-family: "Roboto", "Arial", sans-serif;
        z-index: 9999;
        cursor: not-allowed;
        pointer-events: auto !important;
      `;

      // Add blocked indicator in the center
      const blockedIndicator = document.createElement('div');
      blockedIndicator.style.cssText = `
        padding: 8px 12px;
        background-color: rgba(0, 0, 0, 0.8);
        border-radius: 4px;
        color: white;
        font-size: 12px;
        text-align: center;
        max-width: 80%;
      `;

      const blockedText = document.createElement('div');
      blockedText.style.cssText = `
        font-weight: bold;
        margin-bottom: 4px;
      `;
      blockedText.textContent = 'Video Blocked';

      const filterText = document.createElement('div');
      filterText.style.cssText = `
        font-size: 10px;
        opacity: 0.9;
      `;
      filterText.textContent = `Filter: "${matchedFilter}"`;

      blockedIndicator.appendChild(blockedText);
      blockedIndicator.appendChild(filterText);
      placeholder.appendChild(blockedIndicator);

      // Make sure the thumbnail container has position relative for our absolute positioning
      if (window.getComputedStyle(thumbnailElement).position === 'static') {
        thumbnailElement.style.position = 'relative';
      }

      // Prevent ALL mouse events on the placeholder to stop video preview
      const blockAllEvents = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      };

      // Add event listeners to block all interactions
      placeholder.onclick = blockAllEvents;
      placeholder.onmouseenter = blockAllEvents;
      placeholder.onmouseover = blockAllEvents;
      placeholder.onmousemove = blockAllEvents;
      placeholder.onmousedown = blockAllEvents;
      placeholder.onmouseup = blockAllEvents;
      placeholder.addEventListener('pointerenter', blockAllEvents, true);
      placeholder.addEventListener('pointerover', blockAllEvents, true);
      placeholder.addEventListener('pointermove', blockAllEvents, true);

      // Also block pointer events via CSS
      placeholder.style.pointerEvents = 'auto'; // Make sure it captures events

      // Insert our placeholder as an overlay inside the thumbnail container
      thumbnailElement.appendChild(placeholder);

      // Disable hover preview on the parent container
      thumbnailElement.style.pointerEvents = 'none';

      // Re-enable pointer events ONLY on our overlay to block them
      placeholder.style.pointerEvents = 'auto';

      // Find and stop any video elements that might be playing ANYWHERE on the page
      const stopVideoPreviews = () => {
        // Find any video elements within the container AND in the entire document
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          // Check if this video is related to our blocked element
          const videoContainer = video.closest('ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-radio-renderer, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2');
          if (videoContainer && videoContainer.getAttribute('data-tubegate-blocked') === 'true') {
            video.pause();
            video.src = '';
            video.muted = true;
            video.autoplay = false;
            video.removeAttribute('autoplay');
            video.remove();
          }
        });

        // Remove ytd-moving-thumbnail-renderer elements (inline playback previews)
        const movingThumbnails = element.querySelectorAll('ytd-moving-thumbnail-renderer');
        movingThumbnails.forEach(mt => mt.remove());

        // Also look for iframe previews
        const iframes = element.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          iframe.src = 'about:blank';
          iframe.remove();
        });

        // Remove the mouseover overlay that YouTube uses for previews
        const mouseoverOverlay = element.querySelector('#mouseover-overlay');
        if (mouseoverOverlay) {
          (mouseoverOverlay as HTMLElement).style.display = 'none';
          mouseoverOverlay.remove();
        }

        // Remove hover overlays
        const hoverOverlays = element.querySelector('#hover-overlays');
        if (hoverOverlays) {
          (hoverOverlays as HTMLElement).style.display = 'none';
          hoverOverlays.remove();
        }

        // Also check for preview containers at the document level
        const previewContainers = document.querySelectorAll('[class*="preview"], [id*="preview"]');
        previewContainers.forEach(container => {
          const relatedElement = container.closest('[data-tubegate-blocked="true"]');
          if (relatedElement) {
            (container as HTMLElement).style.display = 'none';
            container.remove();
          }
        });
      };

      // Stop any current previews
      stopVideoPreviews();

      // Set up a mutation observer to stop any dynamically added videos
      const previewObserver = new MutationObserver(() => {
        stopVideoPreviews();
      });

      // Observe both the element AND the document body for preview insertions
      previewObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Store the observer so we can disconnect it if needed
      interface ElementWithTubeGate extends HTMLElement {
        __tubegate_preview_observer?: MutationObserver;
        __tubegate_preview_interval?: number;
      }
      (element as ElementWithTubeGate).__tubegate_preview_observer = previewObserver;

      // Also set up an interval to continuously check for videos (as a fallback)
      const intervalId = setInterval(() => {
        if (!document.contains(element)) {
          clearInterval(intervalId);
          return;
        }
        stopVideoPreviews();
      }, 500);

      (element as ElementWithTubeGate).__tubegate_preview_interval = intervalId;

      // Also disable any links within the thumbnail
      const links = thumbnailElement.querySelectorAll('a');
      links.forEach(link => {
        link.style.pointerEvents = 'none';
        link.onclick = blockAllEvents;
      });

      console.log('[YT Filter] Successfully overlaid thumbnail blocker, metadata preserved, hover disabled');
    } catch (error) {
      console.error('[YT Filter] Error replacing thumbnail:', error);
      // Fall back to the full replacement method if there's an error
      this.replaceWithPlaceholder(element, matchedFilter);
    }
  }

  private replaceWithPlaceholder(element: HTMLElement, matchedFilter: string) {
    try {

      // Find the appropriate parent container
      const container = this.findContainerToReplace(element);
      if (!container) {
        console.warn('[YT Filter] Could not find container to replace');
        return;
      }

      // Hide container while keeping it in layout to avoid first reflow
      container.style.opacity = '0.01';

      // Get dimensions of the container to maintain similar size
      const rect = container.getBoundingClientRect();
      const width = rect.width || 300;
      const height = rect.height || 200;

      const videoInfo = this.extractVideoInfo(element);

      // Create placeholder element
      const placeholder = document.createElement('div');
      placeholder.className = 'tubegate-placeholder';
      placeholder.style.cssText = `
        width: ${width}px;
        min-height: ${Math.max(height, 100)}px;
        padding: 16px;
        margin: 8px;
        background-color: #f5f5f5;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        box-sizing: border-box;
        font-family: "Roboto", "Arial", sans-serif;
      `;

      // Add title
      const titleEl = document.createElement('div');
      titleEl.style.cssText = `
        font-size: 14px;
        font-weight: 500;
        color: #030303;
        margin-bottom: 8px;
        line-height: 1.4;
        word-wrap: break-word;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
      `;
      titleEl.textContent = videoInfo.title || 'Blocked Video';
      placeholder.appendChild(titleEl);

      // Add blocked term indicator
      const blockedTermEl = document.createElement('div');
      blockedTermEl.style.cssText = `
        font-size: 11px;
        color: #606060;
        margin-bottom: 8px;
        font-style: italic;
      `;
      blockedTermEl.textContent = `Blocked term: "${matchedFilter}"`;
      placeholder.appendChild(blockedTermEl);

      // Add link - always show it
      const linkEl = document.createElement('div');
      linkEl.style.cssText = `
        font-size: 12px;
        color: #606060;
      `;

      if (videoInfo.url) {
        const anchor = document.createElement('a');
        anchor.href = videoInfo.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.style.cssText = `
          color: #065fd4;
          text-decoration: none;
        `;
        anchor.textContent = videoInfo.url;
        anchor.addEventListener('mouseenter', () => {
          anchor.style.textDecoration = 'underline';
        });
        anchor.addEventListener('mouseleave', () => {
          anchor.style.textDecoration = 'none';
        });
        linkEl.appendChild(anchor);
      } else {
        linkEl.textContent = 'URL not available';
        linkEl.style.fontStyle = 'italic';
      }

      placeholder.appendChild(linkEl);

      // Replace the container with the placeholder
      container.replaceWith(placeholder);
    } catch (error) {
      console.error('[YT Filter] Error replacing with placeholder:', error);
      // Fall back to removal if placeholder creation fails
      this.removeVideo(element);
    }
  }

  private extractVideoInfo(element: HTMLElement): { title: string; url: string } {
    let title = '';
    let url = '';

    try {
      // Get the container we'll be replacing to search more broadly
      const container = this.findContainerToReplace(element);
      const searchRoot = container || element;

      // Try to find the video title
      // Method 1: Look for title link or heading
      const titleLink = searchRoot.querySelector('a#video-title, a#video-title-link, h3 a, .video-title a');
      if (titleLink) {
        title = titleLink.getAttribute('title') || titleLink.getAttribute('aria-label') || titleLink.textContent?.trim() || '';
        const href = titleLink.getAttribute('href');
        if (href) {
          url = href.startsWith('http') ? href : `https://www.youtube.com${href}`;
        }
      }

      // Method 2: Look for any link with watch or shorts in href
      if (!url) {
        const videoLink = searchRoot.querySelector('a[href*="/watch"], a[href*="/shorts"]');
        if (videoLink) {
          const href = videoLink.getAttribute('href');
          if (href) {
            url = href.startsWith('http') ? href : `https://www.youtube.com${href}`;
          }
          if (!title) {
            title = videoLink.getAttribute('title') || videoLink.getAttribute('aria-label') || '';
          }
        }
      }

      // Method 3: Look for any anchor tag and extract href
      if (!url) {
        const anyLink = searchRoot.querySelector('a[href]');
        if (anyLink) {
          const href = anyLink.getAttribute('href');
          if (href && (href.includes('/watch') || href.includes('/shorts') || href.includes('v='))) {
            url = href.startsWith('http') ? href : `https://www.youtube.com${href}`;
          }
        }
      }

      // Method 4: Look for video ID in data attributes or element structure
      if (!url) {
        // Check for data-video-id attribute
        const videoIdEl = searchRoot.querySelector('[data-video-id]');
        if (videoIdEl) {
          const videoId = videoIdEl.getAttribute('data-video-id');
          if (videoId) {
            url = `https://www.youtube.com/watch?v=${videoId}`;
          }
        }
      }

      // Method 5: Try to extract from container's own attributes
      if (!url && searchRoot) {
        const dataId = searchRoot.getAttribute('data-video-id');
        if (dataId) {
          url = `https://www.youtube.com/watch?v=${dataId}`;
        }
      }

      // Method 6: Search all anchor elements for video URLs
      if (!url) {
        const allLinks = searchRoot.querySelectorAll('a[href]');
        for (const link of Array.from(allLinks)) {
          const href = link.getAttribute('href');
          if (href && (href.includes('/watch?v=') || href.includes('/shorts/'))) {
            url = href.startsWith('http') ? href : `https://www.youtube.com${href}`;
            break;
          }
        }
      }

      // Method 7: Look for title in aria-label attributes
      if (!title) {
        const ariaElement = searchRoot.querySelector('[aria-label*="video" i], [aria-label*="short" i]');
        if (ariaElement) {
          title = ariaElement.getAttribute('aria-label') || '';
        }
      }

      // Method 8: Fallback to first heading text
      if (!title) {
        const heading = searchRoot.querySelector('h1, h2, h3, h4, .title');
        if (heading) {
          title = heading.textContent?.trim() || '';
        }
      }

      // Clean up title - limit length
      if (title.length > 150) {
        title = title.substring(0, 147) + '...';
      }

      // If still no title, use a generic message
      if (!title) {
        title = 'Blocked Video';
      }

    } catch (error) {
      console.error('[YT Filter] Error extracting video info:', error);
      title = 'Blocked Video';
    }

    return { title, url };
  }

  private findContainerToReplace(element: HTMLElement): HTMLElement | null {
    // Try common parent containers in order of preference
    const parentSelectors = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-compact-video-renderer',
      'yt-lockup-view-model',
      'ytd-reel-item-renderer',
    ];

    for (const selector of parentSelectors) {
      const parent = element.closest(selector);
      if (parent) {
        return parent as HTMLElement;
      }
    }

    // Fallback: try to find any container element
    const container = element.closest('[id*="video"], [class*="video"], [id*="content"], [class*="item"]');
    if (container && container !== element) {
      return container as HTMLElement;
    }

    // Last resort: return the element itself
    return element;
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
