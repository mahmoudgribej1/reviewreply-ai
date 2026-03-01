// ─────────────────────────────────────────────
// ReviewReply AI — Auth Bridge Script
// Runs on the web app domain to sync web login → extension
//
// When the user logs in on the website (NextAuth session cookie),
// this script detects it and stores a JWT in chrome.storage.local
// so the extension popup is also logged in.
// ─────────────────────────────────────────────

const BRIDGE_API_URL = "https://reviewreply-ai-hca9.vercel.app";

(async function bridgeAuth() {
  try {
    // Don't run if extension storage already has a valid token
    const { rr_token } = await chrome.storage.local.get(["rr_token"]);

    // Fetch a JWT from the web session (uses the NextAuth cookie)
    const response = await fetch(`${BRIDGE_API_URL}/api/auth/extension-token`, {
      credentials: "include", // send the NextAuth session cookie
    });

    if (!response.ok) {
      // User isn't logged in on the web — if extension has no token, that's fine
      // If extension HAS a token, don't clear it (they might have logged in via popup)
      return;
    }

    const data = await response.json();

    if (data.token) {
      // If extension already has a token for the same email, update it silently.
      // If no token or different user, set the new one.
      await chrome.storage.local.set({
        rr_token: data.token,
        rr_user: data.user,
      });
      console.log("[ReviewReply Bridge] Synced web login → extension");
    }
  } catch (err) {
    // Network error or extension context invalidated — ignore silently
    console.debug("[ReviewReply Bridge] Sync skipped:", err.message);
  }
})();

// ─── Also listen for logout on the web side ──
// When the user signs out on the website, check if the session is gone
// and clear the extension token too.
window.addEventListener("focus", async () => {
  try {
    const response = await fetch(`${BRIDGE_API_URL}/api/auth/extension-token`, {
      credentials: "include",
    });

    if (!response.ok) {
      // Web session is gone (user logged out) — clear extension token too
      // so they're not stuck logged into extension after web logout
      const { rr_token } = await chrome.storage.local.get(["rr_token"]);
      if (rr_token) {
        // Only clear if we're on the app domain (this script runs there),
        // meaning the user intentionally navigated here and logged out
        await chrome.storage.local.remove(["rr_token", "rr_user"]);
        console.log("[ReviewReply Bridge] Web logout detected, cleared extension token");
      }
    }
  } catch {
    // ignore
  }
});
