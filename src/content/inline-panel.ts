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

const PANEL_STYLES = `
  :host {
    all: initial;
    font-family: "Roboto", "Arial", sans-serif;
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2500;
    display: block;
  }

  /* Floating toggle pill */
  .tubegate-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: #667eea;
    color: #fff;
    border: none;
    border-radius: 24px;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0,0,0,0.25);
    transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
    user-select: none;
  }

  .tubegate-pill:hover {
    background: #5a6fd6;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  }

  .tubegate-pill:active {
    transform: translateY(0);
  }

  .tubegate-pill-icon {
    font-weight: 700;
    font-size: 14px;
  }

  .tubegate-pill-count {
    background: rgba(255,255,255,0.25);
    padding: 1px 7px;
    border-radius: 12px;
    font-size: 11px;
  }

  /* Expanded panel */
  .tubegate-panel {
    position: absolute;
    bottom: 48px;
    right: 0;
    width: 320px;
    background: var(--yt-spec-brand-background-primary, #fff);
    border: 1px solid var(--yt-spec-10-percent-layer, #e0e0e0);
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.2);
    overflow: hidden;
    transform-origin: bottom right;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .tubegate-panel.hidden {
    opacity: 0;
    transform: scale(0.95);
    pointer-events: none;
  }

  .tubegate-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--yt-spec-10-percent-layer, #e0e0e0);
  }

  .tubegate-panel-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--yt-spec-text-primary, #0f0f0f);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tubegate-logo-icon {
    width: 20px;
    height: 20px;
    background: #667eea;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .tubegate-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tubegate-toggle {
    position: relative;
    width: 36px;
    height: 20px;
    flex-shrink: 0;
  }

  .tubegate-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .tubegate-toggle-slider {
    position: absolute;
    inset: 0;
    background: #ccc;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .tubegate-toggle-slider::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    left: 2px;
    top: 2px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .tubegate-toggle input:checked + .tubegate-toggle-slider {
    background: #667eea;
  }

  .tubegate-toggle input:checked + .tubegate-toggle-slider::after {
    transform: translateX(16px);
  }

  .tubegate-close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--yt-spec-text-secondary, #606060);
    font-size: 20px;
    padding: 2px 6px;
    line-height: 1;
    border-radius: 50%;
    transition: background 0.15s;
  }

  .tubegate-close-btn:hover {
    background: var(--yt-spec-10-percent-layer, #f0f0f0);
  }

  .tubegate-pill.disabled {
    background: #999;
  }

  .tubegate-pill.disabled:hover {
    background: #888;
  }

  .tubegate-panel-body {
    padding: 12px 16px;
  }

  .tubegate-input-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .tubegate-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--yt-spec-10-percent-layer, #ccc);
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    background: var(--yt-spec-brand-background-primary, #fff);
    color: var(--yt-spec-text-primary, #0f0f0f);
    outline: none;
    transition: border-color 0.15s;
  }

  .tubegate-input:focus {
    border-color: #667eea;
  }

  .tubegate-input::placeholder {
    color: var(--yt-spec-text-secondary, #909090);
  }

  .tubegate-add-btn {
    padding: 8px 14px;
    background: #667eea;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .tubegate-add-btn:hover {
    background: #5a6fd6;
  }

  .tubegate-add-btn:active {
    background: #4e60c2;
  }

  .tubegate-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 200px;
    overflow-y: auto;
    padding-bottom: 4px;
  }

  .tubegate-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--yt-spec-10-percent-layer, #f0f0f0);
    border-radius: 16px;
    font-size: 12px;
    color: var(--yt-spec-text-primary, #0f0f0f);
    line-height: 1.4;
    max-width: 180px;
  }

  .tubegate-tag-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tubegate-tag-remove {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--yt-spec-text-secondary, #909090);
    font-size: 14px;
    padding: 0 2px;
    line-height: 1;
    flex-shrink: 0;
    border-radius: 50%;
    transition: color 0.15s, background 0.15s;
  }

  .tubegate-tag-remove:hover {
    color: #d32f2f;
    background: rgba(211, 47, 47, 0.1);
  }

  .tubegate-empty {
    font-size: 12px;
    color: var(--yt-spec-text-secondary, #909090);
    font-style: italic;
    padding: 4px 0;
  }

  .tubegate-count {
    font-size: 11px;
    color: var(--yt-spec-text-secondary, #606060);
    margin-top: 8px;
  }
`;

export class InlineFilterPanel {
  private hostElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private isOpen = false;
  private filterCount = 0;

  constructor() {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.customFilters) {
        this.renderTags();
      }
      if (changes.enabled !== undefined) {
        this.syncEnabledState();
      }
      if (changes.showPill !== undefined) {
        this.syncVisibility();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      this.syncVisibility();
    });
  }

  async ensureInjected(): Promise<boolean> {
    // Already injected and still in DOM
    if (this.hostElement && document.contains(this.hostElement)) {
      await this.syncVisibility();
      return true;
    }

    this.hostElement = document.createElement('div');
    this.hostElement.id = 'tubegate-inline-panel';
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = PANEL_STYLES;
    this.shadowRoot.appendChild(style);

    // Floating pill button
    const pill = document.createElement('button');
    pill.className = 'tubegate-pill';
    pill.innerHTML = `
      <span class="tubegate-pill-icon">T</span>
      <span>TubeGate</span>
      <span class="tubegate-pill-count">0</span>
    `;
    this.shadowRoot.appendChild(pill);

    // Expandable panel
    const panel = document.createElement('div');
    panel.className = 'tubegate-panel hidden';
    panel.innerHTML = `
      <div class="tubegate-panel-header">
        <span class="tubegate-panel-title">
          <span class="tubegate-logo-icon">T</span>
          TubeGate Filters
        </span>
        <div class="tubegate-header-right">
          <label class="tubegate-toggle" aria-label="Enable or disable filtering">
            <input type="checkbox" class="tubegate-enabled-toggle" checked />
            <span class="tubegate-toggle-slider"></span>
          </label>
          <button class="tubegate-close-btn" aria-label="Close panel">&times;</button>
        </div>
      </div>
      <div class="tubegate-panel-body">
        <div class="tubegate-input-row">
          <input type="text" class="tubegate-input" placeholder="Add filter keyword..." />
          <button class="tubegate-add-btn">Add</button>
        </div>
        <div class="tubegate-tags"></div>
        <div class="tubegate-count"></div>
      </div>
    `;
    this.shadowRoot.appendChild(panel);

    this.setupEventHandlers();
    this.renderTags();
    this.syncEnabledState();

    document.body.appendChild(this.hostElement);
    await this.syncVisibility();
    return true;
  }

  private async syncVisibility() {
    if (!this.hostElement) return;
    const show = await Storage.getShowPill() && !document.fullscreenElement;
    this.hostElement.style.display = show ? '' : 'none';
    if (!show && this.isOpen) {
      this.isOpen = false;
      const panel = this.shadowRoot?.querySelector('.tubegate-panel') as HTMLElement | null;
      if (panel) panel.classList.add('hidden');
    }
  }

  private setupEventHandlers() {
    if (!this.shadowRoot) return;

    const pill = this.shadowRoot.querySelector('.tubegate-pill') as HTMLButtonElement;
    const closeBtn = this.shadowRoot.querySelector('.tubegate-close-btn') as HTMLButtonElement;
    const input = this.shadowRoot.querySelector('.tubegate-input') as HTMLInputElement;
    const addBtn = this.shadowRoot.querySelector('.tubegate-add-btn') as HTMLButtonElement;

    pill.addEventListener('click', () => {
      this.togglePanel();
    });

    closeBtn.addEventListener('click', () => {
      this.togglePanel();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.addFilter(input);
      }
    });

    addBtn.addEventListener('click', () => {
      this.addFilter(input);
    });

    const enabledToggle = this.shadowRoot.querySelector('.tubegate-enabled-toggle') as HTMLInputElement;
    enabledToggle.addEventListener('change', async () => {
      await Storage.setEnabled(enabledToggle.checked);
    });

    // Close panel when clicking outside (on the YouTube page)
    document.addEventListener('click', (e) => {
      if (this.isOpen && this.hostElement && !this.hostElement.contains(e.target as Node)) {
        this.togglePanel();
      }
    });
  }

  private togglePanel() {
    if (!this.shadowRoot) return;

    this.isOpen = !this.isOpen;
    const panel = this.shadowRoot.querySelector('.tubegate-panel') as HTMLElement;
    panel.classList.toggle('hidden', !this.isOpen);

    if (this.isOpen) {
      const input = this.shadowRoot.querySelector('.tubegate-input') as HTMLInputElement;
      // Small delay so the transition starts before focus
      setTimeout(() => input.focus(), 50);
    }
  }

  private async syncEnabledState() {
    if (!this.shadowRoot) return;

    const enabled = await Storage.isEnabled();
    const toggle = this.shadowRoot.querySelector('.tubegate-enabled-toggle') as HTMLInputElement;
    const pill = this.shadowRoot.querySelector('.tubegate-pill') as HTMLElement;

    toggle.checked = enabled;
    pill.classList.toggle('disabled', !enabled);
  }

  private async addFilter(input: HTMLInputElement) {
    const keyword = input.value.trim().toLowerCase();
    if (!keyword) return;

    input.value = '';

    await Storage.addCustomFilter(keyword);

    // Append to filters text so popup stays in sync
    const text = await Storage.getCustomFiltersText();
    const separator = text && !text.endsWith('\n') ? '\n' : '';
    await Storage.setCustomFiltersText(text + separator + keyword);
  }

  private async removeFilter(keyword: string) {
    await Storage.removeCustomFilter(keyword);

    const text = await Storage.getCustomFiltersText();
    const updated = this.removeKeywordFromText(text, keyword);
    await Storage.setCustomFiltersText(updated);
  }

  private removeKeywordFromText(text: string, keyword: string): string {
    const lines = text.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      const commentIdx = line.indexOf('#');
      const contentPart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;

      const parts = contentPart.split(',').map(p => p.trim().toLowerCase());
      const filteredParts = parts.filter(p => p !== keyword);

      if (filteredParts.length === parts.length) {
        result.push(line);
      } else if (filteredParts.some(p => p !== '')) {
        const comment = commentIdx >= 0 ? line.slice(commentIdx) : '';
        const newContent = filteredParts.filter(p => p !== '').join(', ');
        result.push(comment ? `${newContent} ${comment}` : newContent);
      } else {
        const comment = commentIdx >= 0 ? line.slice(commentIdx) : '';
        if (comment) {
          result.push(comment);
        }
      }
    }

    return result.join('\n');
  }

  private async renderTags() {
    if (!this.shadowRoot) return;

    const filters = await Storage.getAllFilters();
    this.filterCount = filters.length;
    const tagsContainer = this.shadowRoot.querySelector('.tubegate-tags') as HTMLElement;
    const countEl = this.shadowRoot.querySelector('.tubegate-count') as HTMLElement;
    const pillCount = this.shadowRoot.querySelector('.tubegate-pill-count') as HTMLElement;

    // Update pill badge
    pillCount.textContent = String(this.filterCount);

    tagsContainer.innerHTML = '';

    if (filters.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tubegate-empty';
      empty.textContent = 'No filters \u2014 add a keyword above';
      tagsContainer.appendChild(empty);
    } else {
      for (const filter of filters) {
        const tag = document.createElement('span');
        tag.className = 'tubegate-tag';

        const text = document.createElement('span');
        text.className = 'tubegate-tag-text';
        text.textContent = filter;
        tag.appendChild(text);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'tubegate-tag-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.setAttribute('aria-label', `Remove filter: ${filter}`);
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeFilter(filter);
        });
        tag.appendChild(removeBtn);

        tagsContainer.appendChild(tag);
      }
    }

    const count = filters.length;
    countEl.textContent = `${count} active ${count === 1 ? 'filter' : 'filters'}`;
  }

  destroy() {
    if (this.hostElement && document.contains(this.hostElement)) {
      this.hostElement.remove();
    }
    this.hostElement = null;
    this.shadowRoot = null;
  }
}
