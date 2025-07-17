// background.js
// This script runs in the background and handles URL recording and storage.

let DEBUG_MODE = false; // Global flag for debugging
let cachedRecordedUrls = []; // Global in-memory cache for recorded URLs
let cachedTargetPatterns = []; // Global in-memory cache for target patterns

/**
 * Initializes the in-memory caches from chrome.storage.local.
 * This function runs immediately when the service worker script loads.
 */
async function initializeCaches() {
  const result = await chrome.storage.local.get([
    "targetPatterns",
    "recordedUrls",
    "isDebugMode",
  ]);

  // Initialize targetPatterns
  cachedTargetPatterns = result.targetPatterns || [];
  if (DEBUG_MODE)
    console.log(
      "Background: Loaded initial cachedTargetPatterns from storage:",
      cachedTargetPatterns,
    );

  // Initialize recordedUrls
  cachedRecordedUrls = result.recordedUrls || [];
  if (DEBUG_MODE)
    console.log(
      "Background: Loaded initial cachedRecordedUrls from storage:",
      cachedRecordedUrls,
    );

  // Initialize debugMode
  DEBUG_MODE = result.isDebugMode || false; // Default to false
  if (DEBUG_MODE)
    console.log(
      "Background: Loaded initial DEBUG_MODE from storage:",
      DEBUG_MODE,
    );

  updateBadgeCount(); // Update badge after caches are loaded
}

// Call initializeCaches immediately when the service worker script starts
initializeCaches();

// This listener runs only once when the extension is installed or updated.
// It ensures default values are set if storage is completely empty (first install).
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    ["targetPatterns", "recordedUrls", "isDebugMode"],
    (result) => {
      if (result.targetPatterns === undefined) {
        chrome.storage.local.set({ targetPatterns: [] });
        if (DEBUG_MODE)
          console.log(
            "Background: onInstalled: Initialized targetPatterns to empty array in storage.",
          );
      }
      if (result.recordedUrls === undefined) {
        chrome.storage.local.set({ recordedUrls: [] });
        if (DEBUG_MODE)
          console.log(
            "Background: onInstalled: Initialized recordedUrls to empty array in storage.",
          );
      }
      if (result.isDebugMode === undefined) {
        chrome.storage.local.set({ isDebugMode: false }); // Default to false
        if (DEBUG_MODE)
          console.log(
            "Background: onInstalled: Initialized isDebugMode to false in storage.",
          );
      }
      // Caches are already initialized by the direct call to initializeCaches()
      // and will be kept in sync by storage.onChanged.
    },
  );
});

// Listen for changes in chrome.storage.local to keep caches in sync
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local") {
    if (changes.isDebugMode !== undefined) {
      DEBUG_MODE = changes.isDebugMode.newValue;
      console.log(`Background: DEBUG_MODE updated to: ${DEBUG_MODE}`); // This log always shows
    }
    if (changes.recordedUrls !== undefined) {
      cachedRecordedUrls = changes.recordedUrls.newValue || [];
      if (DEBUG_MODE)
        console.log(
          `Background: cachedRecordedUrls updated via storage.onChanged. New count: ${cachedRecordedUrls.length}`,
        );
      updateBadgeCount(); // Update badge when recordedUrls change from any source
    }
    if (changes.targetPatterns !== undefined) {
      cachedTargetPatterns = changes.targetPatterns.newValue || [];
      if (DEBUG_MODE)
        console.log(
          `Background: cachedTargetPatterns updated via storage.onChanged. New count: ${cachedTargetPatterns.length}`,
        );
    }
  }
});

/**
 * Updates the extension badge with the current count of recorded URLs.
 */
function updateBadgeCount() {
  // Use the in-memory cache for the count
  const count = cachedRecordedUrls.length;
  chrome.action.setBadgeText({ text: count.toString() });
  chrome.action.setBadgeBackgroundColor({ color: "#4c51bf" }); // Indigo color
  if (DEBUG_MODE)
    console.log(`Background: Attempted to set badge count to: ${count}`);
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
      const regex = new RegExp(patternString, "i"); // Case-insensitive matching
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
 * This function now operates on the global cachedRecordedUrls array.
 * @param {string} url - The URL to add.
 */
function addUrlToStorage(url) {
  // Use the in-memory cache directly
  const targetPatterns = cachedTargetPatterns;
  let currentRecordedUrls = cachedRecordedUrls; // Reference to the global cache

  if (DEBUG_MODE) {
    console.log(`addUrlToStorage: Checking URL: "${url}"`);
    console.log(`addUrlToStorage: Current active patterns:`, targetPatterns);
  }

  if (matchesAnyPattern(url, targetPatterns)) {
    if (DEBUG_MODE)
      console.log(
        `addUrlToStorage: Before deduplication check, cachedRecordedUrls has ${currentRecordedUrls.length} items.`,
      );
    if (DEBUG_MODE)
      console.log(
        `addUrlToStorage: Is "${url}" already in cachedRecordedUrls? ${currentRecordedUrls.includes(
          url,
        )}`,
      );

    if (!currentRecordedUrls.includes(url)) {
      currentRecordedUrls.push(url); // Add to the in-memory cache
      chrome.storage.local.set({ recordedUrls: currentRecordedUrls }, () => {
        // Save the updated cache to storage
        if (DEBUG_MODE)
          console.log(
            `addUrlToStorage: Successfully recorded URL: "${url}". New total URLs: ${currentRecordedUrls.length}`,
          );
        // updateBadgeCount() is now called by storage.onChanged listener for recordedUrls
      });
    } else {
      if (DEBUG_MODE)
        console.log(
          `addUrlToStorage: URL "${url}" is already recorded, skipping.`,
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
  // Ensure the frame is the main frame (not an iframe) and it's a valid HTTP/HTTPS URL
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
 * - 'setTargetPatterns': Sets the array of patterns to monitor.
 * - 'getRecordedUrls': Sends back all recorded URLs and the current target patterns.
 * - 'clearRecordedUrls': Clears all recorded URLs.
 * - 'foundUrlsFromContent': Receives URLs extracted by the content script.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setTargetPatterns") {
    const newTargetPatterns = Array.isArray(request.patterns)
      ? request.patterns.filter((p) => typeof p === "string" && p.trim() !== "")
      : [];
    chrome.storage.local.set({ targetPatterns: newTargetPatterns }, () => {
      // cachedTargetPatterns will be updated by storage.onChanged listener
      if (DEBUG_MODE)
        console.log(`Background: Set new target patterns:`, newTargetPatterns);
      sendResponse({ success: true, patterns: newTargetPatterns });
    });
    return true;
  } else if (request.action === "getRecordedUrls") {
    // Respond with the cached data
    if (DEBUG_MODE)
      console.log(
        `Background: Sending recorded URLs (${cachedRecordedUrls.length}) and patterns (${cachedTargetPatterns.length}) to popup.`,
      );
    sendResponse({
      urls: cachedRecordedUrls,
      targetPatterns: cachedTargetPatterns,
    });
    return true;
  } else if (request.action === "clearRecordedUrls") {
    chrome.storage.local.set({ recordedUrls: [] }, () => {
      // cachedRecordedUrls will be updated by storage.onChanged listener
      if (DEBUG_MODE) console.log("Background: All recorded URLs cleared.");
      // updateBadgeCount() is now called by storage.onChanged listener for recordedUrls
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
