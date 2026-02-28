// ─────────────────────────────────────────────
// ReviewReply AI — Background Service Worker
// ─────────────────────────────────────────────

const API_URL = "http://localhost:3000";

// On first install, open the signup page so user creates an account
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: `${API_URL}/signup` });
  }
});

// ─── Message handler for content.js and popup.js ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TOKEN") {
    chrome.storage.local.get(["rr_token"], (result) => {
      sendResponse({ token: result.rr_token || null });
    });
    return true; // keep channel open for async response
  }

  if (message.type === "SET_TOKEN") {
    chrome.storage.local.set({ rr_token: message.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "CLEAR_TOKEN") {
    chrome.storage.local.remove(["rr_token", "rr_user"], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "API_REQUEST") {
    handleApiRequest(message)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ─── Centralized API request handler ───
async function handleApiRequest({ method, endpoint, body }) {
  const result = await chrome.storage.local.get(["rr_token"]);
  const token = result.rr_token;

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = {
    method: method || "GET",
    headers,
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
