// content.js
// This script runs in the context of the webpage and extracts URLs,
// now including dynamically loaded content, interactive elements, and text content, with optimizations.

let DEBUG_MODE = false; // Global flag for debugging in content script
let urlsToProcess = new Set(); // Temporary set to collect URLs before sending
let debounceTimer; // Timer for debouncing URL sending
const DEBOUNCE_DELAY = 500; // milliseconds

// Load initial debug mode state from storage
chrome.storage.local.get("isDebugMode", (result) => {
  DEBUG_MODE = result.isDebugMode || false; // Default to false
  if (DEBUG_MODE)
    console.log("Content Script: Initial DEBUG_MODE loaded:", DEBUG_MODE);
});

// Listen for changes in chrome.storage.local, specifically for 'isDebugMode'
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.isDebugMode !== undefined) {
    DEBUG_MODE = changes.isDebugMode.newValue;
    console.log(`Content Script: DEBUG_MODE updated to: ${DEBUG_MODE}`); // This log always shows
  }
});

/**
 * Extracts URLs from inline styles (e.g., background-image: url(...))
 * @param {HTMLElement} element - The HTML element to check for inline styles.
 * @param {Set<string>} urlSet - The set to add found URLs to.
 */
const extractUrlsFromStyle = (element, urlSet) => {
  const style = element.getAttribute("style");
  if (style) {
    const urlMatches = style.match(/url\(['"]?(.*?)(?:['"]?\))?/g);
    if (urlMatches) {
      urlMatches.forEach((match) => {
        let urlString = match.replace(/url\(['"]?/, "").replace(/['"]?\)/, "");
        urlString = urlString.replace(/['"]$/, ""); // Remove any trailing quotes
        try {
          const url = new URL(urlString, document.baseURI).href;
          urlSet.add(url);
          if (DEBUG_MODE)
            console.log(`Content Script: Found URL from inline style: ${url}`);
        } catch (e) {
          if (DEBUG_MODE)
            console.error(
              "Content Script: Invalid URL in style attribute:",
              urlString,
              e,
            );
        }
      });
    }
  }
};

/**
 * Extracts URLs from onclick attributes (simple cases)
 * @param {HTMLElement} element - The HTML element to check for onclick attribute.
 * @param {Set<string>} urlSet - The set to add found URLs to.
 */
const extractUrlsFromOnclick = (element, urlSet) => {
  const onclickAttr = element.getAttribute("onclick");
  if (onclickAttr) {
    const urlRegex =
      /(?:window\.location(?:\.href)?\s*=\s*|window\.open\s*\()\s*['"]?(https?:\/\/[^'"]+)['"]?/gi;
    let match;
    while ((match = urlRegex.exec(onclickAttr)) !== null) {
      const urlString = match[1];
      try {
        const url = new URL(urlString, document.baseURI).href;
        urlSet.add(url);
        if (DEBUG_MODE)
          console.log(`Content Script: Found URL from onclick: ${url}`);
      } catch (e) {
        if (DEBUG_MODE)
          console.error(
            "Content Script: Invalid URL in onclick attribute:",
            urlString,
            e,
          );
      }
    }
  }
};

/**
 * Extracts URLs from the text content of <script> tags.
 * @param {HTMLScriptElement} scriptElement - The script element to extract URLs from.
 * @param {Set<string>} urlSet - The set to add found URLs to.
 */
function extractUrlsFromScriptContent(scriptElement, urlSet) {
  if (scriptElement.textContent) {
    const scriptUrlRegex = /(https?:\/\/[^\s"',`{}()\[\]]+)/gi;
    let match;
    while ((match = scriptUrlRegex.exec(scriptElement.textContent)) !== null) {
      const urlString = match[1];
      try {
        const url = new URL(urlString, document.baseURI).href;
        urlSet.add(url);
        if (DEBUG_MODE)
          console.log(`Content Script: Found URL from script content: ${url}`);
      } catch (e) {
        if (DEBUG_MODE)
          console.error(
            "Content Script: Invalid URL in script content:",
            urlString,
            e,
          );
      }
    }
  }
}

/**
 * Extracts URLs from general text content (e.g., within <div>, <span>).
 * @param {string} text - The text content to search for URLs.
 * @param {Set<string>} urlSet - The set to add found URLs to.
 * @param {string} sourceDescription - A description of the text source for logging.
 */
function extractUrlsFromTextContent(
  text,
  urlSet,
  sourceDescription = "text content",
) {
  if (!text) return;
  const generalUrlRegex =
    /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/[a-zA-Z0-9]+\.[^\s]{2,}|[a-zA-Z0-9]+\.[^\s]{2,})/gi;
  let match;
  while ((match = generalUrlRegex.exec(text)) !== null) {
    const urlString = match[0];
    try {
      const url = new URL(urlString, document.baseURI).href;
      urlSet.add(url);
      if (DEBUG_MODE)
        console.log(
          `Content Script: Found URL from ${sourceDescription}: ${url}`,
        );
    } catch (e) {
      if (DEBUG_MODE)
        console.error(
          `Content Script: Invalid URL in ${sourceDescription}:`,
          urlString,
          e,
        );
    }
  }
}

/**
 * Extracts all unique URLs from various HTML elements and attributes within a given node.
 * @param {Node} node - The DOM node to search within (e.g., document or a newly added element).
 * @returns {string[]} An array of unique URLs found.
 */
function extractUrlsFromNode(node) {
  const foundUrls = new Set();

  // Helper function to process elements with a given selector and attribute
  const processElements = (selector, attribute, rootNode = node) => {
    if (
      rootNode.nodeType !== Node.ELEMENT_NODE &&
      rootNode.nodeType !== Node.DOCUMENT_NODE
    ) {
      return;
    }
    rootNode.querySelectorAll(selector).forEach((element) => {
      const urlString = element.getAttribute(attribute);
      if (urlString) {
        try {
          const url = new URL(urlString, document.baseURI).href;
          foundUrls.add(url);
          if (DEBUG_MODE)
            console.log(
              `Content Script: Found URL from ${selector}[${attribute}]: ${url}`,
            );
        } catch (e) {
          if (DEBUG_MODE)
            console.error(
              `Content Script: Invalid URL in ${selector} tag (${attribute}):`,
              urlString,
              e,
            );
        }
      }
    });
  };

  // If the node itself is an element, check its attributes and text content
  if (node.nodeType === Node.ELEMENT_NODE) {
    // Check the node itself for direct attributes
    const attributesToCheck = [
      "href",
      "src",
      "action",
      "srcset",
      "poster",
      "data",
    ];
    attributesToCheck.forEach((attr) => {
      if (node.hasAttribute(attr)) {
        const urlString = node.getAttribute(attr);
        if (urlString) {
          try {
            const url = new URL(urlString, document.baseURI).href;
            foundUrls.add(url);
            if (DEBUG_MODE)
              console.log(
                `Content Script: Found URL from direct attribute ${attr} on element: ${url}`,
              );
          } catch (e) {
            if (DEBUG_MODE)
              console.error(
                `Content Script: Invalid URL in direct attribute ${attr} on element:`,
                urlString,
                e,
              );
          }
        }
      }
    });

    extractUrlsFromStyle(node, foundUrls);
    extractUrlsFromOnclick(node, foundUrls);

    if (node.tagName === "SCRIPT" && node.textContent)
      extractUrlsFromScriptContent(node, foundUrls);

    // Check data-* attributes on the node itself
    const dataAttributes = [
      "data-url",
      "data-href",
      "data-link",
      "data-src",
      "data-image",
      "data-background",
      "data-original",
      "data-original-src",
      "data-original-href",
      "data-video-src",
      "data-poster",
      "data-thumbnail",
      "data-item-url",
      "data-product-url",
      "data-asset-url",
      "data-api-url",
      "data-redirect-url",
      "data-target-url",
    ];
    dataAttributes.forEach((attr) => {
      if (node.hasAttribute(attr)) {
        const urlString = node.getAttribute(attr);
        if (urlString) {
          try {
            const url = new URL(urlString, document.baseURI).href;
            foundUrls.add(url);
            if (DEBUG_MODE)
              console.log(
                `Content Script: Found URL from ${attr} on element: ${url}`,
              );
          } catch (e) {
            if (DEBUG_MODE)
              console.error(
                `Content Script: Invalid URL in ${attr} on element:`,
                urlString,
                e,
              );
          }
        }
      }
    });

    extractUrlsFromTextContent(
      node.textContent,
      foundUrls,
      `element textContent (${node.tagName})`,
    );
  }

  // 1. Extract URLs from common link/resource elements (within the node's subtree)
  processElements("a[href]", "href");
  processElements("img[src]", "src");
  processElements("link[href]", "href");
  processElements("script[src]", "src");
  processElements("iframe[src]", "src");
  processElements("form[action]", "action");
  processElements("img[srcset]", "srcset");
  processElements("source[srcset]", "srcset");
  processElements("video[poster]", "poster");
  processElements("audio[src]", "src");
  processElements("track[src]", "src");
  processElements("object[data]", "data");
  processElements("embed[src]", "src");
  node
    .querySelectorAll("script")
    .forEach((scriptElement) =>
      extractUrlsFromScriptContent(scriptElement, foundUrls),
    );

  // 2. Extract URLs from inline styles (within the node's subtree)
  node
    .querySelectorAll("[style]")
    .forEach((element) => extractUrlsFromStyle(element, foundUrls));

  // 3. Extract URLs from data-* attributes (within the node's subtree)
  const dataAttributesAll = [
    "data-url",
    "data-href",
    "data-link",
    "data-src",
    "data-image",
    "data-background",
    "data-original",
    "data-original-src",
    "data-original-href",
    "data-video-src",
    "data-poster",
    "data-thumbnail",
    "data-item-url",
    "data-product-url",
    "data-asset-url",
    "data-api-url",
    "data-redirect-url",
    "data-target-url",
  ];
  dataAttributesAll.forEach((attr) => {
    if (
      node.nodeType === Node.ELEMENT_NODE ||
      node.nodeType === Node.DOCUMENT_NODE
    ) {
      node.querySelectorAll(`[${attr}]`).forEach((element) => {
        const urlString = element.getAttribute(attr);
        if (urlString) {
          try {
            const url = new URL(urlString, document.baseURI).href;
            foundUrls.add(url);
            if (DEBUG_MODE)
              console.log(`Content Script: Found URL from ${attr}: ${url}`);
          } catch (e) {
            if (DEBUG_MODE)
              console.error(
                `Content Script: Invalid URL in ${attr}:`,
                urlString,
                e,
              );
          }
        }
      });
    }
  });

  // 4. Extract URLs from onclick attributes (within the node's subtree)
  node
    .querySelectorAll("[onclick]")
    .forEach((element) => extractUrlsFromOnclick(element, foundUrls));

  // 6. Apply general text content scanning to all descendant text nodes
  node.querySelectorAll("*").forEach((element) => {
    element.childNodes.forEach((child) => {
      if (
        child.nodeType === Node.TEXT_NODE &&
        child.textContent.trim().length > 0
      ) {
        extractUrlsFromTextContent(
          child.textContent,
          foundUrls,
          `descendant text node of ${element.tagName}`,
        );
      }
    });
  });

  return Array.from(foundUrls);
}

/**
 * Sends collected URLs to the background script after a debounce delay.
 */
function debouncedSendUrls() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (urlsToProcess.size > 0) {
      const urlsArray = Array.from(urlsToProcess);
      if (DEBUG_MODE)
        console.log(
          `Content Script: Debounced sending ${urlsArray.length} URLs to background.`,
        );
      chrome.runtime.sendMessage({
        action: "foundUrlsFromContent",
        urls: urlsArray,
      });
      urlsToProcess.clear(); // Clear the set after sending
    }
  }, DEBOUNCE_DELAY);
}

// Initial extraction when the content script first loads (document_idle)
extractUrlsFromNode(document).forEach((url) => urlsToProcess.add(url));
debouncedSendUrls();

// Set up a MutationObserver to watch for DOM changes (e.g., AJAX loaded content)
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach((node) => {
        // Process element nodes and text nodes directly added
        if (node.nodeType === Node.ELEMENT_NODE) {
          extractUrlsFromNode(node).forEach((url) => urlsToProcess.add(url));
        } else if (
          node.nodeType === Node.TEXT_NODE &&
          node.textContent.trim().length > 0
        ) {
          extractUrlsFromTextContent(
            node.textContent,
            urlsToProcess,
            `added text node`,
          );
        }
      });
    }
    // Also check attribute changes on existing elements if they might contain URLs
    const attributesToObserve = [
      "src",
      "href",
      "action",
      "style",
      "onclick",
      "srcset",
      "poster",
      "data",
      "data-url",
      "data-href",
      "data-link",
      "data-src",
      "data-image",
      "data-background",
      "data-original",
      "data-original-src",
      "data-original-href",
      "data-video-src",
      "data-poster",
      "data-thumbnail",
      "data-item-url",
      "data-product-url",
      "data-asset-url",
      "data-api-url",
      "data-redirect-url",
      "data-target-url",
    ];
    if (
      mutation.type === "attributes" &&
      attributesToObserve.includes(mutation.attributeName) &&
      mutation.target.nodeType === Node.ELEMENT_NODE
    ) {
      extractUrlsFromNode(mutation.target).forEach((url) =>
        urlsToProcess.add(url),
      );
    }
    // Observe character data changes (for text nodes)
    if (
      mutation.type === "characterData" &&
      mutation.target.nodeType === Node.TEXT_NODE &&
      mutation.target.textContent.trim().length > 0
    ) {
      extractUrlsFromTextContent(
        mutation.target.textContent,
        urlsToProcess,
        `characterData change`,
      );
    }
  });

  // Trigger debounced send after processing all mutations in the current batch
  debouncedSendUrls();
});

// Start observing the document body for changes
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  characterData: true,
});
