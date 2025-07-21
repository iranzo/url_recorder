// popup.js
// This script handles the UI logic for the extension's popup.

document.addEventListener("DOMContentLoaded", () => {
  const patternInput = document.getElementById("patternInput");
  const setPatternsButton = document.getElementById("setPatternsButton");
  const clearUrlsButton = document.getElementById("clearUrlsButton");
  const downloadUrlsButton = document.getElementById("downloadUrlsButton");
  const copyUrlsButton = document.getElementById("copyUrlsButton"); // New button element
  const urlList = document.getElementById("urlList");
  const currentPatternsDisplay = document.getElementById(
    "currentPatternsDisplay",
  );
  const totalUrlsCount = document.getElementById("totalUrlsCount");
  const messageBox = document.getElementById("messageBox");
  const debugModeToggle = document.getElementById("debugModeToggle");

  /**
   * Displays a message in the message box.
   * @param {string} message - The message to display.
   * @param {string} type - 'success', 'error', or 'info' for styling.
   */
  function showMessage(message, type = "info") {
    messageBox.textContent = message;
    messageBox.className = "message-box"; // Reset classes
    if (type === "success") {
      messageBox.classList.add(
        "bg-green-100",
        "text-green-800",
        "border-green-200",
      );
    } else if (type === "error") {
      messageBox.classList.add("bg-red-100", "text-red-800", "border-red-200");
    } else {
      // info or default
      messageBox.classList.add(
        "bg-blue-100",
        "text-blue-800",
        "border-blue-200",
      );
    }
    messageBox.style.display = "block";
    setTimeout(() => {
      messageBox.style.display = "none";
    }, 3000); // Hide after 3 seconds
  }

  /**
   * Filters the given URLs based on the provided patterns.
   * @param {string[]} urls - Array of all recorded URLs.
   * @param {string[]} patterns - Array of regex pattern strings.
   * @returns {string[]} Filtered array of URLs that match at least one pattern.
   */
  function filterUrlsByPatterns(urls, patterns) {
    if (!urls || urls.length === 0 || !patterns || patterns.length === 0) {
      return [];
    }

    const filteredUrls = new Set(); // Use a Set to ensure unique URLs
    for (const url of urls) {
      for (const patternString of patterns) {
        try {
          const regex = new RegExp(patternString, "i"); // Case-insensitive regex
          if (regex.test(url)) {
            filteredUrls.add(url);
            break; // Move to the next URL once a match is found
          }
        } catch (e) {
          console.warn(
            `Invalid regex pattern ignored during filtering: ${patternString}`,
            e,
          );
          // Continue to next pattern if one is invalid
        }
      }
    }
    return Array.from(filteredUrls);
  }

  /**
   * Renders the list of URLs in the popup.
   * @param {string[]} urls - An array of URLs to display.
   */
  function renderUrlList(urls) {
    urlList.innerHTML = ""; // Clear existing list
    if (urls && urls.length > 0) {
      urls.forEach((url) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = url;
        a.textContent = url;
        a.target = "_blank"; // Open in new tab
        a.classList.add("text-blue-600", "hover:underline");
        li.appendChild(a);
        urlList.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = "No URLs recorded yet for these patterns.";
      li.classList.add("text-gray-500");
      urlList.appendChild(li);
    }
  }

  /**
   * Fetches the current target patterns and recorded URLs from the background script
   * and updates the popup UI.
   */
  function updatePopupUI() {
    chrome.runtime.sendMessage({ action: "getRecordedUrls" }, (response) => {
      if (response) {
        const currentPatterns = response.targetPatterns || [];
        const allRecordedUrls = response.urls || [];

        // Display current patterns
        if (currentPatterns.length > 0) {
          currentPatternsDisplay.textContent = currentPatterns.join(", ");
          patternInput.value = currentPatterns.join("\n"); // Display in textarea, one per line
        } else {
          currentPatternsDisplay.textContent = "None";
          patternInput.value = "";
        }

        // Update total URLs count
        totalUrlsCount.textContent = allRecordedUrls.length;

        // Filter and render URLs based on current patterns
        const filteredUrls = filterUrlsByPatterns(
          allRecordedUrls,
          currentPatterns,
        );
        renderUrlList(filteredUrls);
      }
    });
  }

  // Initial UI update when the popup opens
  updatePopupUI();

  // Initialize debug mode toggle state
  chrome.storage.local.get("isDebugMode", (result) => {
    debugModeToggle.checked = result.isDebugMode || false; // Default to false
  });

  // Event listener for setting the target patterns
  setPatternsButton.addEventListener("click", () => {
    // Split textarea content by newlines, trim each line, and filter out empty ones
    const patterns = patternInput.value
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p !== "");

    if (patterns.length > 0) {
      chrome.runtime.sendMessage(
        { action: "setTargetPatterns", patterns: patterns },
        (response) => {
          if (response.success) {
            showMessage(
              `Monitoring set for ${response.patterns.length} patterns.`,
              "success",
            );
            updatePopupUI(); // Re-fetch and display
          } else {
            showMessage(`Error setting patterns.`, "error");
          }
        },
      );
    } else {
      // If no patterns entered, set an empty array to stop monitoring
      chrome.runtime.sendMessage(
        { action: "setTargetPatterns", patterns: [] },
        (response) => {
          if (response.success) {
            showMessage("Monitoring stopped (no patterns set).", "info");
            updatePopupUI();
          }
        },
      );
    }
  });

  // Event listener for clearing all recorded URLs
  clearUrlsButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "clearRecordedUrls" }, (response) => {
      if (response.success) {
        showMessage("All recorded URLs cleared.", "success");
        updatePopupUI(); // Update UI to reflect cleared URLs
      } else {
        showMessage("Failed to clear URLs.", "error");
      }
    });
  });

  // Event listener for downloading all recorded URLs
  downloadUrlsButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "getRecordedUrls" }, (response) => {
      if (response && response.urls) {
        const urlsToDownload = response.urls;
        // console.log('Download button clicked. URLs to download:', urlsToDownload); // Debug log

        if (urlsToDownload.length === 0) {
          showMessage("No URLs to download.", "info");
          return;
        }

        try {
          const content = urlsToDownload.join("\n"); // Join URLs with newlines
          const blob = new Blob([content], { type: "text/plain" });
          const url = URL.createObjectURL(blob);

          // Create a temporary anchor element and trigger a click to download
          const a = document.createElement("a");
          a.href = url;
          a.download = "recorded_urls.txt"; // Default filename
          document.body.appendChild(a); // Append to body is necessary for Firefox
          a.click(); // Programmatically click the link
          document.body.removeChild(a); // Clean up the temporary element
          URL.revokeObjectURL(url); // Release the object URL

          showMessage(`Downloaded ${urlsToDownload.length} URLs.`, "success");
          // console.log(`Successfully initiated download for ${urlsToDownload.length} URLs.`); // Debug log
        } catch (e) {
          console.error("Error during download process:", e); // Log any errors during download
          showMessage("An error occurred during download.", "error");
        }
      } else {
        showMessage("Failed to retrieve URLs for download.", "error");
        // console.error('Failed to retrieve URLs from background script for download.'); // Debug log
      }
    });
  });

  // Event listener for copying all recorded URLs to clipboard
  copyUrlsButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "getRecordedUrls" }, (response) => {
      if (response && response.urls) {
        const urlsToCopy = response.urls;
        if (urlsToCopy.length === 0) {
          showMessage("No URLs to copy.", "info");
          return;
        }

        try {
          const textToCopy = urlsToCopy.join("\n");
          // Create a temporary textarea element to hold the text
          const tempTextArea = document.createElement("textarea");
          tempTextArea.value = textToCopy;
          tempTextArea.style.position = "fixed"; // Keep it off-screen
          tempTextArea.style.left = "-9999px";
          tempTextArea.style.top = "-9999px";
          document.body.appendChild(tempTextArea);
          tempTextArea.focus();
          tempTextArea.select(); // Select the text

          // Execute the copy command
          const success = document.execCommand("copy");
          document.body.removeChild(tempTextArea); // Clean up

          if (success) {
            showMessage(
              `Copied ${urlsToCopy.length} URLs to clipboard.`,
              "success",
            );
          } else {
            showMessage("Failed to copy URLs to clipboard.", "error");
          }
        } catch (e) {
          console.error("Error during copy to clipboard process:", e);
          showMessage("An error occurred during copy to clipboard.", "error");
        }
      } else {
        showMessage("Failed to retrieve URLs for copy to clipboard.", "error");
      }
    });
  });

  // Event listener for the debug mode toggle
  debugModeToggle.addEventListener("change", () => {
    const isDebug = debugModeToggle.checked;
    chrome.storage.local.set({ isDebugMode: isDebug }, () => {
      showMessage(`Debugging ${isDebug ? "enabled" : "disabled"}.`, "info");
      // No need to send message to background/content scripts directly here,
      // as they will listen to chrome.storage.onChanged.
    });
  });
});
