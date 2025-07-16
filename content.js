// content.js
// This script runs in the context of the webpage and extracts URLs,
// now including dynamically loaded content and more interactive elements, with optimizations.

let DEBUG_MODE = false; // Global flag for debugging in content script
let urlsToProcess = new Set(); // Temporary set to collect URLs before sending
let debounceTimer; // Timer for debouncing URL sending
const DEBOUNCE_DELAY = 500; // milliseconds

// Load initial debug mode state from storage
chrome.storage.local.get('isDebugMode', (result) => {
    DEBUG_MODE = result.isDebugMode || false; // Default to false
    if (DEBUG_MODE) console.log("Content Script: Initial DEBUG_MODE loaded:", DEBUG_MODE);
});

// Listen for changes in chrome.storage.local, specifically for 'isDebugMode'
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.isDebugMode !== undefined) {
        DEBUG_MODE = changes.isDebugMode.newValue;
        console.log(`Content Script: DEBUG_MODE updated to: ${DEBUG_MODE}`); // This log always shows
    }
});

/**
 * Extracts all unique URLs from various HTML elements and attributes within a given node.
 * @param {Node} node - The DOM node to search within (e.g., document or a newly added element).
 * @returns {string[]} An array of unique URLs found.
 */
function extractUrlsFromNode(node) {
    const foundUrls = new Set();

    // Helper function to process elements with a given selector and attribute
    const processElements = (selector, attribute, rootNode = node) => {
        // Use querySelectorAll on the provided rootNode to find elements within it
        rootNode.querySelectorAll(selector).forEach(element => {
            const urlString = element.getAttribute(attribute);
            if (urlString) {
                try {
                    // Resolve relative URLs against the document's base URI
                    const url = new URL(urlString, document.baseURI).href;
                    foundUrls.add(url);
                    if (DEBUG_MODE) console.log(`Content Script: Found URL from ${selector}[${attribute}]: ${url}`);
                } catch (e) {
                    if (DEBUG_MODE) console.error(`Content Script: Invalid URL in ${selector} tag (${attribute}):`, urlString, e);
                }
            }
        });
    };

    // If the node itself is an element, check its attributes too
    if (node.nodeType === Node.ELEMENT_NODE) {
        // Check the node itself for direct attributes
        if (node.hasAttribute('href')) processElements('', 'href', node); // For <a> or <link>
        if (node.hasAttribute('src')) processElements('', 'src', node);   // For <img>, <script>, <iframe>
        if (node.hasAttribute('action')) processElements('', 'action', node); // For <form>
        if (node.hasAttribute('style')) extractUrlsFromStyle(node); // For inline styles on the node itself
        if (node.hasAttribute('onclick')) extractUrlsFromOnclick(node); // For onclick on the node itself

        // Check data-* attributes on the node itself
        const dataAttributes = ['data-url', 'data-href', 'data-link'];
        dataAttributes.forEach(attr => {
            if (node.hasAttribute(attr)) {
                const urlString = node.getAttribute(attr);
                if (urlString) {
                    try {
                        const url = new URL(urlString, document.baseURI).href;
                        foundUrls.add(url);
                        if (DEBUG_MODE) console.log(`Content Script: Found URL from ${attr} on element: ${url}`);
                    } catch (e) {
                        if (DEBUG_MODE) console.error(`Content Script: Invalid URL in ${attr} on element:`, urlString, e);
                    }
                }
            }
        });
    }


    // 1. Extract URLs from common link/resource elements (within the node's subtree)
    processElements('a[href]', 'href');
    processElements('img[src]', 'src');
    processElements('link[href]', 'href');
    processElements('script[src]', 'src');
    processElements('iframe[src]', 'src');
    processElements('form[action]', 'action'); // Form actions

    // 2. Extract URLs from inline styles (e.g., background-image: url(...))
    const extractUrlsFromStyle = (element) => {
        const style = element.getAttribute('style');
        if (style) {
            const urlMatches = style.match(/url\(['"]?(.*?)['"]?\)/g);
            if (urlMatches) {
                urlMatches.forEach(match => {
                    const urlString = match.replace(/url\(['"]?/, '').replace(/['"]?\)/, '');
                    try {
                        const url = new URL(urlString, document.baseURI).href;
                        foundUrls.add(url);
                        if (DEBUG_MODE) console.log(`Content Script: Found URL from inline style: ${url}`);
                    } catch (e) {
                        if (DEBUG_MODE) console.error("Content Script: Invalid URL in style attribute:", urlString, e);
                    }
                });
            }
        }
    };
    node.querySelectorAll('[style]').forEach(extractUrlsFromStyle); // Check children for inline styles

    // 3. Extract URLs from data-* attributes (e.g., data-url, data-href, data-link)
    const dataAttributes = ['data-url', 'data-href', 'data-link'];
    dataAttributes.forEach(attr => {
        node.querySelectorAll(`[${attr}]`).forEach(element => {
            const urlString = element.getAttribute(attr);
            if (urlString) {
                try {
                    const url = new URL(urlString, document.baseURI).href;
                    foundUrls.add(url);
                    if (DEBUG_MODE) console.log(`Content Script: Found URL from ${attr}: ${url}`);
                } catch (e) {
                    if (DEBUG_MODE) console.error(`Content Script: Invalid URL in ${attr}:`, urlString, e);
                }
            }
        });
    });

    // 4. Extract URLs from onclick attributes (simple cases)
    // This is a best-effort attempt for direct URL assignments.
    const extractUrlsFromOnclick = (element) => {
        const onclickAttr = element.getAttribute('onclick');
        if (onclickAttr) {
            // Regex to find patterns like window.location.href = 'url' or window.open('url')
            const urlRegex = /(?:window\.location\.href\s*=\s*|window\.open\s*\()\s*['"](https?:\/\/[^'"]+)['"]/gi;
            let match;
            while ((match = urlRegex.exec(onclickAttr)) !== null) {
                const urlString = match[1];
                try {
                    const url = new URL(urlString, document.baseURI).href;
                    foundUrls.add(url);
                    if (DEBUG_MODE) console.log(`Content Script: Found URL from onclick: ${url}`);
                } catch (e) {
                    if (DEBUG_MODE) console.error("Content Script: Invalid URL in onclick attribute:", urlString, e);
                }
            }
        }
    };
    node.querySelectorAll('[onclick]').forEach(extractUrlsFromOnclick);

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
            if (DEBUG_MODE) console.log(`Content Script: Debounced sending ${urlsArray.length} URLs to background.`);
            chrome.runtime.sendMessage({ action: 'foundUrlsFromContent', urls: urlsArray });
            urlsToProcess.clear(); // Clear the set after sending
        }
    }, DEBOUNCE_DELAY);
}

// Initial extraction when the content script first loads (document_idle)
extractUrlsFromNode(document).forEach(url => urlsToProcess.add(url));
debouncedSendUrls();

// Set up a MutationObserver to watch for DOM changes (e.g., AJAX loaded content)
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach(node => {
                // Only process element nodes (not text nodes, comments, etc.)
                if (node.nodeType === Node.ELEMENT_NODE) {
                    extractUrlsFromNode(node).forEach(url => urlsToProcess.add(url));
                }
            });
        }
        // Also check attribute changes on existing elements if they might contain URLs
        if (mutation.type === 'attributes' &&
            ['src', 'href', 'action', 'style', 'onclick', 'data-url', 'data-href', 'data-link'].includes(mutation.attributeName) &&
            mutation.target.nodeType === Node.ELEMENT_NODE) {
            extractUrlsFromNode(mutation.target).forEach(url => urlsToProcess.add(url));
        }
    });

    // Trigger debounced send after processing all mutations in the current batch
    debouncedSendUrls();
});

// Start observing the document body for changes
// subtree: true means it will observe changes in all descendants of the target node
// childList: true means it will observe additions/removals of child nodes
// attributes: true means it will observe changes to attributes (e.g., src, href, onclick, data-url)
observer.observe(document.body, { childList: true, subtree: true, attributes: true });
