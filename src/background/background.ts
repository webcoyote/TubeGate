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
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === 'VIDEO_BLOCKED') {
    console.log('Video blocked:', message.title);
  }

  return true;
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('YouTube Filter: Browser started');
});
