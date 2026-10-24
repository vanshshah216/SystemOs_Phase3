const API_URL = "http://127.0.0.1:8000/browser-activity";
const pendingNewTabs = new Set();
const lastSent = new Map();

const browserName = navigator.userAgent.includes("Edg/")
  ? "Microsoft Edge"
  : "Google Chrome";

function isBrowserInternalUrl(url = "") {
  return /^(chrome|edge|about|chrome-extension|edge-extension):/i.test(url);
}

async function sendTab(tab, action) {
  if (!tab?.id || !tab.title || isBrowserInternalUrl(tab.url)) return;

  const key = `${tab.id}:${action}:${tab.title}`;
  const now = Date.now();
  if (lastSent.get(key) && now - lastSent.get(key) < 2000) return;
  lastSent.set(key, now);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        browser: browserName,
        title: tab.title,
        action,
      }),
    });
    if (!response.ok) {
      console.warn("SYSTEMOS did not record browser activity:", response.status);
    }
  } catch (error) {
    console.warn("SYSTEMOS browser activity API is unavailable:", error);
  }
}

async function recordExistingTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.status === "complete") {
      await sendTab(tab, "observed");
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  recordExistingTabs().catch(error => {
    console.warn("SYSTEMOS could not inspect existing browser tabs:", error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  recordExistingTabs().catch(error => {
    console.warn("SYSTEMOS could not inspect browser tabs at startup:", error);
  });
});

chrome.tabs.onCreated.addListener(tab => {
  if (tab.id) pendingNewTabs.add(tab.id);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.title || (!changeInfo.title && changeInfo.status !== "complete")) return;
  const action = pendingNewTabs.delete(tabId) ? "opened" : "title_changed";
  sendTab(tab, action);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError) return;
    sendTab(tab, "activated");
  });
});

chrome.tabs.onRemoved.addListener(tabId => {
  pendingNewTabs.delete(tabId);
  for (const key of lastSent.keys()) {
    if (key.startsWith(`${tabId}:`)) lastSent.delete(key);
  }
});
