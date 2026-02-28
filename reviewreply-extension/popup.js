// ─────────────────────────────────────────────
// ReviewReply AI — Popup Script
// ─────────────────────────────────────────────

const API_URL = "http://localhost:3000";

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
  userName.textContent = user.name || "there";

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
    const limit = user.generationsLimit || 10;
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
    const res = await fetch(`${API_URL}/api/lemonsqueezy/checkout`, {
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
    const res = await fetch(`${API_URL}/api/lemonsqueezy/portal`, {
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
