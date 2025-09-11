// background.js
// This script runs in the background and handles URL recording and storage.

let DEBUG_MODE = false; // Global flag for debugging
let cachedRecordedUrls = []; // Global in-memory cache for recorded URLs
let cachedTargetPatterns = []; // Global in-memory cache for target patterns
let isUrlSimplificationEnabled = false; // New flag for URL simplification
let ignoredUrlParams = []; // New array for parameters to ignore

/**
 * Initializes the in-memory caches from chrome.storage.local.
 * This function runs immediately when the service worker script loads.
 */
async function initializeCaches() {
  const result = await chrome.storage.local.get([
    "targetPatterns",
    "recordedUrls",
    "isDebugMode",
    "isUrlSimplificationEnabled",
    "ignoredUrlParams",
  ]);

  // Initialize caches
  cachedTargetPatterns = result.targetPatterns || [];
  cachedRecordedUrls = result.recordedUrls || [];
  DEBUG_MODE = result.isDebugMode || false;
  isUrlSimplificationEnabled = result.isUrlSimplificationEnabled || false;
  ignoredUrlParams = result.ignoredUrlParams || [];

  if (DEBUG_MODE) {
    console.log(
      "Background: Loaded initial cachedTargetPatterns:",
      cachedTargetPatterns,
    );
    console.log(
      "Background: Loaded initial cachedRecordedUrls:",
      cachedRecordedUrls,
    );
    console.log("Background: Loaded initial DEBUG_MODE:", DEBUG_MODE);
    console.log(
      "Background: Loaded initial isUrlSimplificationEnabled:",
      isUrlSimplificationEnabled,
    );
    console.log(
      "Background: Loaded initial ignoredUrlParams:",
      ignoredUrlParams,
    );
  }

  updateBadgeCount();
}

// Call initializeCaches immediately when the service worker script starts
initializeCaches();

// This listener runs only once when the extension is installed or updated.
// It ensures default values are set if storage is completely empty (first install).
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    [
      "targetPatterns",
      "recordedUrls",
      "isDebugMode",
      "isUrlSimplificationEnabled",
      "ignoredUrlParams",
    ],
    (result) => {
      if (result.targetPatterns === undefined) {
        chrome.storage.local.set({ targetPatterns: [] });
      }
      if (result.recordedUrls === undefined) {
        chrome.storage.local.set({ recordedUrls: [] });
      }
      if (result.isDebugMode === undefined) {
        chrome.storage.local.set({ isDebugMode: false });
      }
      if (result.isUrlSimplificationEnabled === undefined) {
        chrome.storage.local.set({ isUrlSimplificationEnabled: false });
      }
      if (result.ignoredUrlParams === undefined) {
        chrome.storage.local.set({ ignoredUrlParams: [] });
      }
    },
  );
});

// Listen for changes in chrome.storage.local to keep caches in sync
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local") {
    if (changes.isDebugMode !== undefined) {
      DEBUG_MODE = changes.isDebugMode.newValue;
      console.log(`Background: DEBUG_MODE updated to: ${DEBUG_MODE}`);
    }
    if (changes.recordedUrls !== undefined) {
      cachedRecordedUrls = changes.recordedUrls.newValue || [];
      if (DEBUG_MODE)
        console.log(
          `Background: cachedRecordedUrls updated via storage.onChanged. New count: ${cachedRecordedUrls.length}`,
        );
      updateBadgeCount();
    }
    if (changes.targetPatterns !== undefined) {
      cachedTargetPatterns = changes.targetPatterns.newValue || [];
      if (DEBUG_MODE)
        console.log(
          `Background: cachedTargetPatterns updated via storage.onChanged. New count: ${cachedTargetPatterns.length}`,
        );
    }
    if (changes.isUrlSimplificationEnabled !== undefined) {
      isUrlSimplificationEnabled = changes.isUrlSimplificationEnabled.newValue;
      if (DEBUG_MODE)
        console.log(
          `Background: isUrlSimplificationEnabled updated to: ${isUrlSimplificationEnabled}`,
        );
    }
    if (changes.ignoredUrlParams !== undefined) {
      ignoredUrlParams = changes.ignoredUrlParams.newValue || [];
      if (DEBUG_MODE)
        console.log(
          `Background: ignoredUrlParams updated. New count: ${ignoredUrlParams.length}`,
        );
    }
  }
});

/**
 * Updates the extension badge with the current count of recorded URLs.
 */
function updateBadgeCount() {
  const count = cachedRecordedUrls.length;
  chrome.action.setBadgeText({ text: count.toString() });
  chrome.action.setBadgeBackgroundColor({ color: "#4c51bf" });
  if (DEBUG_MODE)
    console.log(`Background: Attempted to set badge count to: ${count}`);
}

/**
 * Normalizes a URL by removing specific query parameters.
 * @param {string} url - The original URL string.
 * @param {string[]} paramsToIgnore - An array of query parameter keys to remove.
 * @returns {string} The normalized URL.
 */
function normalizeUrl(url, paramsToIgnore) {
  if (!paramsToIgnore || paramsToIgnore.length === 0) {
    return url;
  }
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    for (const param of paramsToIgnore) {
      if (params.has(param)) {
        params.delete(param);
      }
    }
    urlObj.search = params.toString();
    return urlObj.toString();
  } catch (e) {
    if (DEBUG_MODE) console.error(`Failed to normalize URL: ${url}`, e);
    return url;
  }
}

/**
 * Checks if a given URL or its simplified version is already in the cache.
 * @param {string} url - The URL to check.
 * @returns {boolean} True if the URL (or its simplified version) is already in the cache, false otherwise.
 */
function isUrlInCache(url) {
  if (isUrlSimplificationEnabled) {
    const normalizedUrl = normalizeUrl(url, ignoredUrlParams);
    if (DEBUG_MODE)
      console.log(`Background: Checking for normalized URL: ${normalizedUrl}`);
    return cachedRecordedUrls.some((cachedUrl) => {
      const cachedNormalized = normalizeUrl(cachedUrl, ignoredUrlParams);
      return cachedNormalized === normalizedUrl;
    });
  } else {
    return cachedRecordedUrls.includes(url);
  }
}

/**
 * Checks if a given URL matches any of the stored regex patterns.
 * @param {string} url - The URL to test.
 * @param {string[]} patterns - An array of regex pattern strings.
 * @returns {boolean} True if the URL matches any pattern, false otherwise.
 */
function matchesAnyPattern(url, patterns) {
  if (!url || !patterns || patterns.length === 0) {
    if (DEBUG_MODE)
      console.log(
        "matchesAnyPattern: No patterns set or URL invalid, returning false.",
      );
    return false;
  }
  for (const patternString of patterns) {
    try {
      const regex = new RegExp(patternString, "i");
      if (regex.test(url)) {
        if (DEBUG_MODE)
          console.log(
            `matchesAnyPattern: URL "${url}" matched pattern "${patternString}".`,
          );
        return true;
      }
    } catch (e) {
      if (DEBUG_MODE)
        console.warn(
          `matchesAnyPattern: Invalid regex pattern ignored: "${patternString}"`,
          e,
        );
    }
  }
  if (DEBUG_MODE)
    console.log(
      `matchesAnyPattern: URL "${url}" did not match any active pattern.`,
    );
  return false;
}

/**
 * Adds a URL to storage if it matches the target patterns and is not already present.
 * @param {string} url - The URL to add.
 */
function addUrlToStorage(url) {
  const targetPatterns = cachedTargetPatterns;
  let currentRecordedUrls = cachedRecordedUrls;

  if (DEBUG_MODE) {
    console.log(`addUrlToStorage: Checking URL: "${url}"`);
    console.log(`addUrlToStorage: Current active patterns:`, targetPatterns);
  }

  if (matchesAnyPattern(url, targetPatterns)) {
    if (DEBUG_MODE)
      console.log(
        `addUrlToStorage: Before deduplication check, cachedRecordedUrls has ${currentRecordedUrls.length} items.`,
      );

    if (!isUrlInCache(url)) {
      currentRecordedUrls.push(url);
      chrome.storage.local.set({ recordedUrls: currentRecordedUrls }, () => {
        if (DEBUG_MODE)
          console.log(
            `addUrlToStorage: Successfully recorded URL: "${url}". New total URLs: ${currentRecordedUrls.length}`,
          );
      });
    } else {
      if (DEBUG_MODE)
        console.log(
          `addUrlToStorage: URL "${url}" is already recorded (or a simplified version of it), skipping.`,
        );
    }
  } else {
    if (DEBUG_MODE)
      console.log(
        `addUrlToStorage: URL "${url}" did not match any active pattern, not recording.`,
      );
  }
}

/**
 * Listens for web navigation events and records the navigated URL.
 */
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (
    details.frameId === 0 &&
    (details.url.startsWith("http://") || details.url.startsWith("https://"))
  ) {
    if (DEBUG_MODE)
      console.log(
        `WebNavigation: onBeforeNavigate triggered for: "${details.url}"`,
      );
    addUrlToStorage(details.url);
  }
});

/**
 * Handles messages from the popup script and content script.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setTargetPatterns") {
    const newTargetPatterns = Array.isArray(request.patterns)
      ? request.patterns.filter((p) => typeof p === "string" && p.trim() !== "")
      : [];
    chrome.storage.local.set({ targetPatterns: newTargetPatterns }, () => {
      if (DEBUG_MODE)
        console.log(`Background: Set new target patterns:`, newTargetPatterns);
      sendResponse({ success: true, patterns: newTargetPatterns });
    });
    return true;
  } else if (request.action === "setSimplificationSettings") {
    chrome.storage.local.set(
      {
        isUrlSimplificationEnabled: request.isEnabled,
        ignoredUrlParams: request.params,
      },
      () => {
        if (DEBUG_MODE)
          console.log(
            `Background: Set URL simplification settings. Enabled: ${request.isEnabled}, Ignored Params:`,
            request.params,
          );
        sendResponse({ success: true });
      },
    );
    return true;
  } else if (request.action === "getRecordedUrls") {
    if (DEBUG_MODE)
      console.log(
        `Background: Sending recorded URLs (${cachedRecordedUrls.length}) and patterns (${cachedTargetPatterns.length}) to popup.`,
      );
    sendResponse({
      urls: cachedRecordedUrls,
      targetPatterns: cachedTargetPatterns,
      isUrlSimplificationEnabled: isUrlSimplificationEnabled,
      ignoredUrlParams: ignoredUrlParams,
    });
    return true;
  } else if (request.action === "clearRecordedUrls") {
    chrome.storage.local.set({ recordedUrls: [] }, () => {
      if (DEBUG_MODE) console.log("Background: All recorded URLs cleared.");
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === "foundUrlsFromContent") {
    if (Array.isArray(request.urls) && request.urls.length > 0) {
      if (DEBUG_MODE)
        console.log(
          `Background: Received ${request.urls.length} URLs from content script.`,
        );
      request.urls.forEach((url) => {
        addUrlToStorage(url);
      });
    }
    sendResponse({ success: true });
    return true;
  }
});
