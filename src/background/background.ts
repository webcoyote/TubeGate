import { STORAGE_KEYS } from '../types';

// Initialize default values on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('YouTube Filter: Extension installed');

    // Set default values
    await chrome.storage.sync.set({
      [STORAGE_KEYS.CUSTOM_FILTERS]: [],
      [STORAGE_KEYS.DEFAULT_FILTERS_ENABLED]: true
    });

    await chrome.storage.local.set({
      [STORAGE_KEYS.STATISTICS]: {
        blockedToday: 0,
        lastResetDate: new Date().toDateString()
      }
    });

    // Open welcome page or options page
    chrome.tabs.create({
      url: 'https://www.youtube.com'
    });
  } else if (details.reason === 'update') {
    console.log('YouTube Filter: Extension updated');
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VIDEO_BLOCKED') {
    console.log('Video blocked:', message.title);
  }

  return true;
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('YouTube Filter: Browser started');
});
