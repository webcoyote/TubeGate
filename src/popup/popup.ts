import { Storage } from '../utils/storage';

class PopupController {
  private tabBtns: NodeListOf<HTMLElement>;
  private tabContents: NodeListOf<HTMLElement>;
  private customFiltersList: HTMLElement;
  private newFilterInput: HTMLInputElement;
  private addFilterBtn: HTMLElement;
  private blockedCountEl: HTMLElement;
  private filterCountEl: HTMLElement;
  private resetStatsBtn: HTMLElement;
  private feedbackBtn: HTMLElement;

  constructor() {
    this.tabBtns = document.querySelectorAll('.tab-btn');
    this.tabContents = document.querySelectorAll('.tab-content');
    this.customFiltersList = document.getElementById('customFiltersList')!;
    this.newFilterInput = document.getElementById('newFilterInput') as HTMLInputElement;
    this.addFilterBtn = document.getElementById('addFilterBtn')!;
    this.blockedCountEl = document.getElementById('blockedCount')!;
    this.filterCountEl = document.getElementById('filterCount')!;
    this.resetStatsBtn = document.getElementById('resetStatsBtn')!;
    this.feedbackBtn = document.getElementById('feedbackBtn')!;

    this.init();
  }

  private async init() {
    this.setupEventListeners();
    await this.loadData();
  }

  private setupEventListeners() {
    // Tab switching
    this.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab!));
    });

    // Add filter
    this.addFilterBtn.addEventListener('click', () => this.addFilter());
    this.newFilterInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addFilter();
      }
    });

    // Reset statistics
    this.resetStatsBtn.addEventListener('click', () => this.resetStatistics());

    // Feedback
    this.feedbackBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://github.com/webcoyote/yt-filter/issues' });
    });
  }

  private switchTab(tabName: string) {
    this.tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    this.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
  }

  private async loadData() {
    // Load custom filters
    await this.renderCustomFilters();

    // Load statistics
    await this.updateStatistics();

    // Update filter count
    await this.updateFilterCount();
  }

  private async renderCustomFilters() {
    const filters = await Storage.getCustomFilters();

    if (filters.length === 0) {
      this.customFiltersList.innerHTML = '<div class="empty-state">No custom filters yet</div>';
      return;
    }

    this.customFiltersList.innerHTML = filters.map(filter => `
      <div class="filter-item">
        <span class="filter-text">${this.escapeHtml(filter)}</span>
        <button class="filter-remove" data-filter="${this.escapeHtml(filter)}">×</button>
      </div>
    `).join('');

    // Add event listeners to remove buttons
    this.customFiltersList.querySelectorAll('.filter-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const filter = (e.target as HTMLElement).dataset.filter!;
        await this.removeFilter(filter);
      });
    });
  }

  private async addFilter() {
    const filterText = this.newFilterInput.value.trim().toLowerCase();

    if (!filterText) {
      return;
    }

    if (filterText.length > 50) {
      alert('Filter keyword is too long (max 50 characters)');
      return;
    }

    await Storage.addCustomFilter(filterText);
    this.newFilterInput.value = '';
    await this.renderCustomFilters();
    await this.updateFilterCount();
  }

  private async removeFilter(filter: string) {
    await Storage.removeCustomFilter(filter);
    await this.renderCustomFilters();
    await this.updateFilterCount();
  }

  private async updateStatistics() {
    const stats = await Storage.getStatistics();
    this.blockedCountEl.textContent = stats.blockedToday.toString();
  }

  private async updateFilterCount() {
    const allFilters = await Storage.getAllFilters();
    this.filterCountEl.textContent = allFilters.length.toString();
  }

  private async resetStatistics() {
    if (confirm('Are you sure you want to reset statistics?')) {
      await Storage.setStatistics({
        blockedToday: 0,
        lastResetDate: new Date().toDateString()
      });
      await this.updateStatistics();
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
