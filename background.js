// HueLoot – background service worker
// Listens for the extension icon click and injects the content script.

chrome.action.onClicked.addListener(async (tab) => {
  // Guard: only run on http/https pages
  if (!tab.url || !/^https?:\/\//.test(tab.url)) {
    chrome.action.setBadgeText({ text: "!", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#e57373", tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 2000);
    return;
  }

  try {
    // CSS is now loaded inside the Shadow DOM — only inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    chrome.action.setBadgeText({ text: "", tabId: tab.id });
  } catch (err) {
    console.error("[HueLoot] Injection error:", err);
    chrome.action.setBadgeText({ text: "ERR", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#e57373", tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 3000);
  }
});
