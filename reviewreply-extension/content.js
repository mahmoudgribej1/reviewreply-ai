// ─────────────────────────────────────────────
// ReviewReply AI — Content Script
// Injected into https://business.google.com/*
// ─────────────────────────────────────────────

const RR_API_URL = "http://localhost:3000";
const DEBOUNCE_MS = 500;

let debounceTimer = null;
let lastUrl = location.href;

// ─── Entry Point ─────────────────────────────
function main() {
  // Run injection immediately for any reviews already on the page
  scheduleInjection();

  // Watch for DOM changes (GBP is a React SPA — reviews load async)
  const observer = new MutationObserver(() => {
    scheduleInjection();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Watch for SPA URL changes (no full page reload)
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scheduleInjection();
    }
  }, 1000);
}

// ─── Debounced injection scheduler ───────────
function scheduleInjection() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    injectButtons();
  }, DEBOUNCE_MS);
}

// ─── Find and inject buttons into reviews ────
function injectButtons() {
  // Google Business Profile review containers
  // These selectors target the review management page
  // GBP uses dynamic class names, so we look for structural patterns
  
  // Find all review containers — look for elements that contain review text
  // and reply areas. GBP typically uses specific ARIA roles and data attributes.
  const reviewContainers = findReviewContainers();

  reviewContainers.forEach((container) => {
    // Skip if already injected
    if (container.dataset.rrInjected === "true") return;

    const reviewData = extractReviewData(container);
    if (!reviewData) return;

    const replyArea = findReplyArea(container);
    if (!replyArea) return;

    injectGenerateButton(container, replyArea, reviewData);
    container.dataset.rrInjected = "true";
  });
}

// ─── Find review containers on the page ──────
function findReviewContainers() {
  // Strategy: look for common GBP review page patterns
  // The review page shows cards with reviewer info, star ratings, and reply boxes
  
  // Try multiple selector strategies for resilience
  const selectors = [
    // GBP review cards typically have role or specific structure
    '[data-review-id]',
    '.review-card',
    // Fallback: look for containers with star ratings and reply buttons
    '[aria-label*="star"]',
    '[aria-label*="Star"]',
    '[aria-label*="rated"]',
    '[aria-label*="Rated"]',
  ];

  // First try data-review-id (most reliable if it exists)
  for (const selector of selectors.slice(0, 2)) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) return Array.from(elements);
  }

  // Fallback: find star rating elements and walk up to their review container
  for (const selector of selectors.slice(2)) {
    const ratingElements = document.querySelectorAll(selector);
    if (ratingElements.length > 0) {
      const containers = new Set();
      ratingElements.forEach((el) => {
        // Walk up to find a reasonable container (usually 3-5 levels up)
        let parent = el;
        for (let i = 0; i < 8; i++) {
          if (!parent.parentElement) break;
          parent = parent.parentElement;
          // Look for a container that's big enough to be a review card
          if (parent.offsetHeight > 100 && parent.offsetWidth > 200) {
            // Check if this container has text content that looks like a review
            const text = parent.textContent || "";
            if (text.length > 50) {
              containers.add(parent);
              break;
            }
          }
        }
      });
      if (containers.size > 0) return Array.from(containers);
    }
  }

  return [];
}

// ─── Extract review data from a container ────
function extractReviewData(container) {
  const text = container.textContent || "";
  
  // Extract star rating from aria-label
  let starRating = null;
  const ratingEl = container.querySelector('[aria-label*="star"], [aria-label*="Star"], [aria-label*="rated"], [aria-label*="Rated"]');
  if (ratingEl) {
    const ariaLabel = ratingEl.getAttribute("aria-label") || "";
    const match = ariaLabel.match(/(\d)/);
    if (match) starRating = parseInt(match[1]);
  }

  // Also try to find rating from filled star icons
  if (!starRating) {
    const filledStars = container.querySelectorAll('[aria-label="Full star"], .filled-star, [data-rating]');
    if (filledStars.length > 0) {
      starRating = filledStars.length;
    }
  }

  // Extract reviewer name — usually the first prominent text element
  let reviewerName = null;
  const nameSelectors = [
    '[data-reviewer-name]',
    '.reviewer-name',
    'a[href*="contrib"]', // Google profile links
  ];
  for (const sel of nameSelectors) {
    const el = container.querySelector(sel);
    if (el) {
      reviewerName = el.textContent?.trim();
      break;
    }
  }

  // If no specific selector found, try to find a name-like element
  if (!reviewerName) {
    // The reviewer name is typically in a bold or heading element near the top
    const boldElements = container.querySelectorAll("strong, b, h3, h4, [role='heading']");
    for (const el of boldElements) {
      const name = el.textContent?.trim();
      if (name && name.length > 1 && name.length < 50 && !name.includes("Reply") && !name.includes("star")) {
        reviewerName = name;
        break;
      }
    }
  }

  // Extract review text — look for the longest paragraph-like text
  let reviewText = null;
  const textElements = container.querySelectorAll("p, span, div");
  let longestText = "";
  textElements.forEach((el) => {
    const elText = el.textContent?.trim() || "";
    // Review text is usually the longest text block that isn't a name or rating
    if (
      elText.length > longestText.length &&
      elText.length > 20 &&
      elText.length < 5000 &&
      !elText.includes("Reply") &&
      el.children.length < 3 // Leaf-ish node
    ) {
      longestText = elText;
    }
  });
  if (longestText) reviewText = longestText;

  if (!reviewText && !starRating) return null;

  return {
    reviewText: reviewText || "(No text review)",
    reviewerName: reviewerName || "the customer",
    starRating: starRating || 3,
  };
}

// ─── Find the reply textarea or reply button ─
function findReplyArea(container) {
  // Look for an existing textarea (reply box already open)
  const textarea = container.querySelector('textarea, [contenteditable="true"], [role="textbox"]');
  if (textarea) return textarea;

  // Look for a "Reply" button that opens the textarea
  const buttons = container.querySelectorAll("button, [role='button']");
  for (const btn of buttons) {
    const btnText = btn.textContent?.trim().toLowerCase() || "";
    if (btnText === "reply" || btnText.includes("reply")) {
      return btn;
    }
  }

  return null;
}

// ─── Inject the Generate Reply button ────────
function injectGenerateButton(container, replyArea, reviewData) {
  const wrapper = document.createElement("div");
  wrapper.className = "rr-button-wrapper";

  const btn = document.createElement("button");
  btn.className = "rr-generate-btn";
  btn.innerHTML = '✨ <span>Generate Reply</span>';
  btn.title = "Generate an AI reply with ReviewReply AI";

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleGenerate(btn, container, replyArea, reviewData);
  });

  wrapper.appendChild(btn);

  // Insert the button near the reply area
  if (replyArea.tagName === "TEXTAREA" || replyArea.getAttribute("contenteditable") || replyArea.getAttribute("role") === "textbox") {
    // Reply box is already open — insert button above it
    replyArea.parentElement.insertBefore(wrapper, replyArea);
  } else {
    // Reply button exists — insert our button next to it
    replyArea.parentElement.insertBefore(wrapper, replyArea.nextSibling);
  }
}

// ─── Handle Generate button click ────────────
async function handleGenerate(btn, container, replyArea, reviewData) {
  // Check for token
  const { rr_token } = await chrome.storage.local.get(["rr_token"]);
  if (!rr_token) {
    showToast("Please log in via the ReviewReply extension popup", "warning");
    return;
  }

  // Show loading state
  btn.disabled = true;
  btn.classList.add("rr-loading");
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="rr-spinner"></span> <span>Generating...</span>';

  try {
    const response = await fetch(`${RR_API_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rr_token}`,
      },
      body: JSON.stringify({
        reviewText: reviewData.reviewText,
        reviewerName: reviewData.reviewerName,
        starRating: reviewData.starRating,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429 || data.error === "Monthly generation limit reached") {
        showToast(
          "You've used all your free generations this month. Upgrade to Pro!",
          "error",
          `${RR_API_URL}/dashboard?upgrade=true`
        );
        return;
      }
      throw new Error(data.error || "Generation failed");
    }

    // Insert reply into the textarea
    const inserted = insertReplyText(container, replyArea, data.reply);

    if (inserted) {
      // Update button to show regenerate
      btn.innerHTML = '↻ <span>Regenerate</span>';
      btn.classList.remove("rr-loading");
      btn.classList.add("rr-regenerate");
      btn.disabled = false;

      showToast("Reply generated! Review and hit Send.", "success");
    } else {
      throw new Error("Could not insert reply into the text field");
    }
  } catch (err) {
    console.error("[ReviewReply] Generation error:", err);
    btn.innerHTML = originalHTML;
    btn.classList.remove("rr-loading");
    showToast(err.message || "Something went wrong", "error");
  } finally {
    if (btn.classList.contains("rr-loading")) {
      btn.innerHTML = originalHTML;
      btn.classList.remove("rr-loading");
    }
    btn.disabled = false;
  }
}

// ─── Insert generated reply into textarea ────
function insertReplyText(container, replyArea, text) {
  // If replyArea is a button (reply not yet open), click it first
  if (
    replyArea.tagName === "BUTTON" ||
    (replyArea.getAttribute("role") === "button" && !replyArea.getAttribute("contenteditable"))
  ) {
    replyArea.click();

    // Wait for textarea to appear after clicking Reply
    return new Promise((resolve) => {
      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        const textarea = container.querySelector('textarea, [contenteditable="true"], [role="textbox"]');
        if (textarea) {
          clearInterval(check);
          setTextareaValue(textarea, text);
          resolve(true);
        } else if (attempts > 20) {
          clearInterval(check);
          resolve(false);
        }
      }, 200);
    });
  }

  // Direct textarea insertion
  setTextareaValue(replyArea, text);
  return true;
}

// ─── Set textarea value and trigger React change detection ───
function setTextareaValue(textarea, text) {
  // For native textarea elements
  if (textarea.tagName === "TEXTAREA" || textarea.tagName === "INPUT") {
    // Use the native setter to bypass React's synthetic event system
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(textarea, text);
    } else {
      textarea.value = text;
    }

    // Dispatch events so React detects the change
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }
  // For contenteditable divs
  else if (textarea.getAttribute("contenteditable") === "true" || textarea.getAttribute("role") === "textbox") {
    textarea.focus();
    textarea.textContent = text;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Focus the textarea so the user can see and edit
  textarea.focus();
}

// ─── Toast Notification ──────────────────────
function showToast(message, type = "info", linkUrl = null) {
  // Remove existing toast
  const existing = document.querySelector(".rr-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `rr-toast rr-toast-${type}`;

  if (linkUrl) {
    toast.innerHTML = `
      <span>${message}</span>
      <a href="${linkUrl}" target="_blank" class="rr-toast-link">Upgrade →</a>
    `;
  } else {
    toast.textContent = message;
  }

  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add("rr-toast-visible");
  });

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.classList.remove("rr-toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// ─── Start ───────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
