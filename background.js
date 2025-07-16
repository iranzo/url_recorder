// background.js
// This script runs in the background and handles URL recording and storage.

let DEBUG_MODE = false; // Global flag for debugging

// Initialize storage with an empty array for recorded URLs and no target patterns.
// This listener runs only once when the extension is installed or updated.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    ["targetPatterns", "recordedUrls", "isDebugMode"],
    (result) => {
      if (result.targetPatterns === undefined) {
        chrome.storage.local.set({ targetPatterns: [] });
        if (DEBUG_MODE)
          console.log("Background: Initialized targetPatterns to empty array.");
      }
      if (result.recordedUrls === undefined) {
        chrome.storage.local.set({ recordedUrls: [] });
        if (DEBUG_MODE)
          console.log("Background: Initialized recordedUrls to empty array.");
      }
      if (result.isDebugMode === undefined) {
        chrome.storage.local.set({ isDebugMode: false }); // Default to false
        if (DEBUG_MODE)
          console.log("Background: Initialized isDebugMode to false.");
      } else {
        DEBUG_MODE = result.isDebugMode; // Set initial DEBUG_MODE from storage
        if (DEBUG_MODE)
          console.log(
            "Background: Loaded initial DEBUG_MODE from storage:",
            DEBUG_MODE,
          );
      }
    },
  );
});

// Listen for changes in chrome.storage.local, specifically for 'isDebugMode'
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.isDebugMode !== undefined) {
    DEBUG_MODE = changes.isDebugMode.newValue;
    console.log(`Background: DEBUG_MODE updated to: ${DEBUG_MODE}`); // This log always shows
  }
});

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
 * @param {string} url - The URL to add.
 */
function addUrlToStorage(url) {
  chrome.storage.local.get(["targetPatterns", "recordedUrls"], (result) => {
    const targetPatterns = result.targetPatterns || [];
    let recordedUrls = result.recordedUrls || [];

    if (DEBUG_MODE) {
      console.log(`addUrlToStorage: Checking URL: "${url}"`);
      console.log(`addUrlToStorage: Current active patterns:`, targetPatterns);
    }

    if (matchesAnyPattern(url, targetPatterns)) {
      if (!recordedUrls.includes(url)) {
        recordedUrls.push(url);
        chrome.storage.local.set({ recordedUrls: recordedUrls }, () => {
          if (DEBUG_MODE)
            console.log(
              `addUrlToStorage: Successfully recorded URL: "${url}". Total URLs: ${recordedUrls.length}`,
            );
        });
      } else {
        if (DEBUG_MODE)
          console.log(`addUrlToStorage: URL "${url}" is already recorded.`);
      }
    } else {
      if (DEBUG_MODE)
        console.log(
          `addUrlToStorage: URL "${url}" did not match any active pattern, not recording.`,
        );
    }
  });
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
      if (DEBUG_MODE)
        console.log(`Background: Set new target patterns:`, newTargetPatterns);
      sendResponse({ success: true, patterns: newTargetPatterns });
    });
    return true;
  } else if (request.action === "getRecordedUrls") {
    chrome.storage.local.get(["targetPatterns", "recordedUrls"], (result) => {
      const targetPatterns = result.targetPatterns || [];
      const recordedUrls = result.recordedUrls || [];
      if (DEBUG_MODE)
        console.log(
          `Background: Sending recorded URLs (${recordedUrls.length}) and patterns (${targetPatterns.length}) to popup.`,
        );
      sendResponse({ urls: recordedUrls, targetPatterns: targetPatterns });
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
