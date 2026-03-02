// ─────────────────────────────────────────────
// ReviewReply AI — Popup Script
// ─────────────────────────────────────────────

const API_URL = "https://reviewreply-ai-hca9.vercel.app";

// ─── DOM Elements ────────────────────────────
const loadingState = document.getElementById("loading-state");
const loggedOutState = document.getElementById("logged-out-state");
const loggedInState = document.getElementById("logged-in-state");

const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const signupLink = document.getElementById("signup-link");
const googleLoginBtn = document.getElementById("google-login-btn");

const userName = document.getElementById("user-name");
const planBadge = document.getElementById("plan-badge");
const usageText = document.getElementById("usage-text");
const usageFill = document.getElementById("usage-fill");
const upgradeBtn = document.getElementById("upgrade-btn");
const manageBillingBtn = document.getElementById("manage-billing-btn");
const settingsBtn = document.getElementById("settings-btn");
const logoutBtn = document.getElementById("logout-btn");

// ─── Initialize ──────────────────────────────
document.addEventListener("DOMContentLoaded", init);

async function init() {
  showState("loading");

  const { rr_token } = await chrome.storage.local.get(["rr_token"]);

  if (!rr_token) {
    showState("logged-out");
    return;
  }

  // Verify token is still valid by fetching user data
  try {
    const response = await fetch(`${API_URL}/api/me`, {
      headers: { Authorization: `Bearer ${rr_token}` },
    });

    if (!response.ok) {
      // Token expired or invalid
      await chrome.storage.local.remove(["rr_token", "rr_user"]);
      showState("logged-out");
      return;
    }

    const data = await response.json();
    renderLoggedIn(data.user);
  } catch (err) {
    console.error("Failed to fetch user data:", err);
    showState("logged-out");
  }
}

// ─── Show State ──────────────────────────────
function showState(state) {
  loadingState.classList.add("hidden");
  loggedOutState.classList.add("hidden");
  loggedInState.classList.add("hidden");

  if (state === "loading") loadingState.classList.remove("hidden");
  if (state === "logged-out") loggedOutState.classList.remove("hidden");
  if (state === "logged-in") loggedInState.classList.remove("hidden");
}

// ─── Render Logged In ────────────────────────
function renderLoggedIn(user) {
  // Show owner first name if set, fall back to personal name, then generic greeting
  userName.textContent = user.ownerFirstName || user.name || "there";

  // Plan badge
  if (user.plan === "PRO") {
    planBadge.textContent = "PRO";
    planBadge.className = "badge badge-pro";
  } else {
    planBadge.textContent = "FREE";
    planBadge.className = "badge badge-free";
  }

  // Usage
  if (user.plan === "PRO") {
    usageText.textContent = "Unlimited generations";
    usageFill.style.width = "100%";
  } else {
    const used = user.generationsUsed || 0;
    const limit = user.generationsLimit || 30;
    usageText.textContent = `${used} of ${limit} generations used`;
    usageFill.style.width = `${Math.min((used / limit) * 100, 100)}%`;
  }

  // Show/hide action buttons based on plan
  if (user.plan === "PRO") {
    upgradeBtn.classList.add("hidden");
    manageBillingBtn.classList.remove("hidden");
  } else {
    upgradeBtn.classList.remove("hidden");
    manageBillingBtn.classList.add("hidden");
  }

  showState("logged-in");
}

// ─── Login Form ──────────────────────────────
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  loginError.classList.add("hidden");
  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    const response = await fetch(`${API_URL}/api/auth/extension-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }

    // Store token
    await chrome.storage.local.set({
      rr_token: data.token,
      rr_user: data.user,
    });

    renderLoggedIn(data.user);
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Log In";
  }
});

// ─── Google OAuth Login ──────────────────────
googleLoginBtn.addEventListener("click", async () => {
  loginError.classList.add("hidden");
  googleLoginBtn.disabled = true;
  googleLoginBtn.textContent = "Signing in...";

  try {
    // Build Google OAuth URL using chrome.identity redirect
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", await getGoogleClientId());
    authUrl.searchParams.set("redirect_uri", redirectUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("access_type", "offline");

    // Launch OAuth flow in a browser popup
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });

    // Extract the authorization code from the redirect
    const url = new URL(responseUrl);
    const code = url.searchParams.get("code");

    if (!code) {
      throw new Error("No authorization code received");
    }

    // Exchange code for JWT via our backend
    const response = await fetch(`${API_URL}/api/auth/extension-google-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirectUri: redirectUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Google login failed");
    }

    // Store token
    await chrome.storage.local.set({
      rr_token: data.token,
      rr_user: data.user,
    });

    renderLoggedIn(data.user);
  } catch (err) {
    // User closing the popup is not an error we need to show
    if (err.message?.includes("canceled") || err.message?.includes("cancelled")) {
      // User closed the OAuth window — do nothing
    } else {
      loginError.textContent = err.message || "Google sign-in failed";
      loginError.classList.remove("hidden");
    }
  } finally {
    googleLoginBtn.disabled = false;
    googleLoginBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 48 48" style="vertical-align: middle; margin-right: 8px;"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Sign in with Google`;
  }
});

// Fetch Google Client ID from backend (it's a public value)
let _cachedClientId = null;
async function getGoogleClientId() {
  if (_cachedClientId) return _cachedClientId;
  const res = await fetch(`${API_URL}/api/auth/google-client-id`);
  const data = await res.json();
  _cachedClientId = data.clientId;
  return _cachedClientId;
}

// ─── Signup Link ─────────────────────────────
signupLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${API_URL}/signup` });
});

// ─── Upgrade to Pro ──────────────────────────
upgradeBtn.addEventListener("click", async () => {
  upgradeBtn.disabled = true;
  upgradeBtn.textContent = "Loading…";

  try {
    const { rr_token } = await chrome.storage.local.get(["rr_token"]);
    const res = await fetch(`${API_URL}/api/gumroad/checkout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${rr_token}` },
    });

    const data = await res.json();
    if (data.checkoutUrl) {
      chrome.tabs.create({ url: data.checkoutUrl });
    } else {
      alert(data.error || "Failed to start checkout");
    }
  } catch (err) {
    alert("Network error — please try again");
  } finally {
    upgradeBtn.disabled = false;
    upgradeBtn.textContent = "✨ Upgrade to Pro";
  }
});

// ─── Manage Billing ──────────────────────────
manageBillingBtn.addEventListener("click", async () => {
  manageBillingBtn.disabled = true;
  manageBillingBtn.textContent = "Loading…";

  try {
    const { rr_token } = await chrome.storage.local.get(["rr_token"]);
    const res = await fetch(`${API_URL}/api/gumroad/portal`, {
      method: "POST",
      headers: { Authorization: `Bearer ${rr_token}` },
    });

    const data = await res.json();
    if (data.portalUrl) {
      chrome.tabs.create({ url: data.portalUrl });
    } else {
      alert(data.error || "Failed to open billing portal");
    }
  } catch (err) {
    alert("Network error — please try again");
  } finally {
    manageBillingBtn.disabled = false;
    manageBillingBtn.textContent = "Manage Billing";
  }
});

// ─── Settings ────────────────────────────────
settingsBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: `${API_URL}/dashboard?tab=settings` });
});

// ─── Logout ──────────────────────────────────
logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["rr_token", "rr_user"]);
  showState("logged-out");
  emailInput.value = "";
  passwordInput.value = "";
});
