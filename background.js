// HueLoot – background service worker
// Listens for the extension icon click and injects the content script.

chrome.action.onClicked.addListener(async (tab) => {
  // Guard: only run on http/https pages
  if (!tab.url || !/^https?:\/\//.test(tab.url)) return;

  try {
    // Inject the CSS first so the modal is styled before JS runs
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["modal.css"],
    });

    // Inject (or re-inject) the content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (err) {
    console.error("[HueLoot] Injection error:", err);
  }
});
