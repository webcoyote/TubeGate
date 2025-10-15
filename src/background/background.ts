import { STORAGE_KEYS } from '../types';

// Initialize default values on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default values
    await chrome.storage.sync.set({
      [STORAGE_KEYS.CUSTOM_FILTERS]: []
    });

    // Open welcome page
    chrome.tabs.create({
      url: 'https://www.youtube.com'
    });
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
