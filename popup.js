// popup.js
// This script handles the UI logic for the extension's popup.

document.addEventListener("DOMContentLoaded", () => {
  const patternInput = document.getElementById("patternInput");
  const setPatternsButton = document.getElementById("setPatternsButton");
  const clearUrlsButton = document.getElementById("clearUrlsButton");
  const downloadUrlsButton = document.getElementById("downloadUrlsButton");
  const copyUrlsButton = document.getElementById("copyUrlsButton");
  const urlList = document.getElementById("urlList");
  const currentPatternsDisplay = document.getElementById(
    "currentPatternsDisplay",
  );
  const totalUrlsCount = document.getElementById("totalUrlsCount");
  const messageBox = document.getElementById("messageBox");
  const debugModeToggle = document.getElementById("debugModeToggle");

  // New UI elements for URL simplification
  const simplifyUrlsToggle = document.getElementById("simplifyUrlsToggle");
  const ignoredParamsInput = document.getElementById("ignoredParamsInput");

  /**
   * Displays a message in the message box.
   * @param {string} message - The message to display.
   * @param {string} type - 'success', 'error', or 'info' for styling.
   */
  function showMessage(message, type = "info") {
    messageBox.textContent = message;
    messageBox.className = "message-box";
    if (type === "success") {
      messageBox.classList.add(
        "bg-green-100",
        "text-green-800",
        "border-green-200",
      );
    } else if (type === "error") {
      messageBox.classList.add("bg-red-100", "text-red-800", "border-red-200");
    } else {
      messageBox.classList.add(
        "bg-blue-100",
        "text-blue-800",
        "border-blue-200",
      );
    }
    messageBox.style.display = "block";
    setTimeout(() => {
      messageBox.style.display = "none";
    }, 3000);
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

    const filteredUrls = new Set();
    for (const url of urls) {
      for (const patternString of patterns) {
        try {
          const regex = new RegExp(patternString, "i");
          if (regex.test(url)) {
            filteredUrls.add(url);
            break;
          }
        } catch (e) {
          console.warn(
            `Invalid regex pattern ignored during filtering: ${patternString}`,
            e,
          );
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
    urlList.innerHTML = "";
    if (urls && urls.length > 0) {
      urls.forEach((url) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = url;
        a.textContent = url;
        a.target = "_blank";
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
   * Fetches the current settings and recorded URLs from the background script
   * and updates the popup UI.
   */
  function updatePopupUI() {
    chrome.runtime.sendMessage({ action: "getRecordedUrls" }, (response) => {
      if (response) {
        const currentPatterns = response.targetPatterns || [];
        const allRecordedUrls = response.urls || [];
        const isSimplificationEnabled =
          response.isUrlSimplificationEnabled || false;
        const ignoredParams = response.ignoredUrlParams || [];

        if (currentPatterns.length > 0) {
          currentPatternsDisplay.textContent = `${currentPatterns.length} patterns`;
          patternInput.value = currentPatterns.join("\n");
        } else {
          currentPatternsDisplay.textContent = "None";
          patternInput.value = "";
        }

        totalUrlsCount.textContent = allRecordedUrls.length;

        simplifyUrlsToggle.checked = isSimplificationEnabled;
        ignoredParamsInput.value = ignoredParams.join(", ");

        const filteredUrls = filterUrlsByPatterns(
          allRecordedUrls,
          currentPatterns,
        );
        renderUrlList(filteredUrls);
      }
    });
  }

  updatePopupUI();

  // Event listener for setting the target patterns
  setPatternsButton.addEventListener("click", () => {
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
            updatePopupUI();
          } else {
            showMessage(`Error setting patterns.`, "error");
          }
        },
      );
    } else {
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

  // Event listener for URL simplification settings
  simplifyUrlsToggle.addEventListener("change", sendSimplificationSettings);
  ignoredParamsInput.addEventListener("input", sendSimplificationSettings);

  function sendSimplificationSettings() {
    const isEnabled = simplifyUrlsToggle.checked;
    const params = ignoredParamsInput.value
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p !== "");

    chrome.runtime.sendMessage(
      {
        action: "setSimplificationSettings",
        isEnabled: isEnabled,
        params: params,
      },
      (response) => {
        if (response.success) {
          showMessage("URL simplification settings updated.", "success");
        } else {
          showMessage("Error updating simplification settings.", "error");
        }
      },
    );
  }

  // Event listener for clearing all recorded URLs
  clearUrlsButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "clearRecordedUrls" }, (response) => {
      if (response.success) {
        showMessage("All recorded URLs cleared.", "success");
        updatePopupUI();
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
        if (urlsToDownload.length === 0) {
          showMessage("No URLs to download.", "info");
          return;
        }
        try {
          const content = urlsToDownload.join("\n");
          const blob = new Blob([content], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "recorded_urls.txt";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showMessage(`Downloaded ${urlsToDownload.length} URLs.`, "success");
        } catch (e) {
          console.error("Error during download process:", e);
          showMessage("An error occurred during download.", "error");
        }
      } else {
        showMessage("Failed to retrieve URLs for download.", "error");
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
          const tempTextArea = document.createElement("textarea");
          tempTextArea.value = textToCopy;
          tempTextArea.style.position = "fixed";
          tempTextArea.style.left = "-9999px";
          tempTextArea.style.top = "-9999px";
          document.body.appendChild(tempTextArea);
          tempTextArea.focus();
          tempTextArea.select();
          const success = document.execCommand("copy");
          document.body.removeChild(tempTextArea);
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
    });
  });
});
