// ─────────────────────────────────────────────
// ReviewReply AI — Content Script
// Injected into Google Maps (google.com/maps/*)
// ─────────────────────────────────────────────

const RR_API_URL = "http://localhost:3000";
const DEBOUNCE_MS = 600;

let debounceTimer = null;
let lastUrl = location.href;

// ─── Entry Point ─────────────────────────────
function main() {
  console.log("[ReviewReply] Content script loaded on:", location.hostname);

  // Initial injection pass
  scheduleInjection();

  // Google Maps is a heavy SPA — reviews load lazily via AJAX.
  // We watch the DOM for any new nodes (review cards appearing)
  const observer = new MutationObserver(() => {
    scheduleInjection();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also watch for SPA URL changes (no full page reload in Maps)
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log("[ReviewReply] URL changed, re-scanning...");
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
  const reviewContainers = findReviewContainers();

  if (reviewContainers.length > 0) {
    console.log(`[ReviewReply] Found ${reviewContainers.length} review(s)`);
  }

  reviewContainers.forEach((container) => {
    // Skip if we already injected a button
    if (container.dataset.rrInjected === "true") return;

    const reviewData = extractReviewData(container);
    if (!reviewData) return;

    injectGenerateButton(container, reviewData);
    container.dataset.rrInjected = "true";
  });
}

// ─── Find review containers on the page ──────
// Uses a layered strategy for resilience against DOM changes
function findReviewContainers() {
  // ── Strategy 1: data-review-id (most reliable for Google Maps)
  // Google Maps assigns a unique Base64 data-review-id to every review card.
  let containers = document.querySelectorAll("[data-review-id]");
  if (containers.length > 0) return Array.from(containers);

  // ── Strategy 2: .review-card (test page / custom pages)
  containers = document.querySelectorAll(".review-card");
  if (containers.length > 0) return Array.from(containers);

  // ── Strategy 3: Heuristic — find star rating elements & walk up
  // Stars on Google Maps use role="img" with aria-label like "5 stars"
  // Our test page uses .stars with aria-label "Rated X out of 5 stars"
  const starSelectors = [
    'span[role="img"][aria-label*="star"]',
    '[aria-label*="Rated"][aria-label*="star"]',
    '.stars[aria-label*="star"]',
  ];

  for (const selector of starSelectors) {
    const starElements = document.querySelectorAll(selector);
    if (starElements.length === 0) continue;

    const found = new Set();
    starElements.forEach((el) => {
      // Walk up the DOM to find a suitable review container
      let parent = el;
      for (let i = 0; i < 12; i++) {
        if (!parent.parentElement) break;
        parent = parent.parentElement;

        // A review container is a decently-sized block with text content
        const rect = parent.getBoundingClientRect();
        if (rect.height > 60 && rect.width > 200 && parent.children.length >= 2) {
          const text = parent.textContent || "";
          if (text.length > 40) {
            // Make sure we haven't walked too far up (stop at large containers)
            if (rect.height < 800) {
              found.add(parent);
            }
            break;
          }
        }
      }
    });

    if (found.size > 0) return Array.from(found);
  }

  return [];
}

// ─── Extract review data from a container ────
function extractReviewData(container) {
  // ── Extract star rating ────────────────────
  let starRating = null;

  // Google Maps: <span role="img" aria-label="5 stars">
  // Test page: <div class="stars" aria-label="Rated 5 out of 5 stars">
  const ratingEl = container.querySelector(
    '[role="img"][aria-label*="star"], [aria-label*="Rated"][aria-label*="star"], .stars[aria-label*="star"]'
  );

  if (ratingEl) {
    const ariaLabel = ratingEl.getAttribute("aria-label") || "";
    // Match patterns: "5 stars", "Rated 5 out of 5", "4 stars", etc.
    const match = ariaLabel.match(/(\d)\s*(?:out of \d\s*)?star/i);
    if (match) starRating = parseInt(match[1]);
  }

  // Fallback: count filled star elements
  if (!starRating) {
    const filledStars = container.querySelectorAll(
      ".star.filled, .star-filled, [aria-label='Full star']"
    );
    if (filledStars.length > 0 && filledStars.length <= 5) {
      starRating = filledStars.length;
    }
  }

  // ── Extract reviewer name ──────────────────
  let reviewerName = null;

  // Google Maps: reviewer name is usually a button or link near the top
  // that links to /contrib/ profile. Also sometimes in aria-label of the card.
  const nameSelectors = [
    "[data-reviewer-name]",         // Explicit attribute (test page)
    ".reviewer-name",               // Class-based (test page)
    'button[data-href*="contrib"]', // Google Maps contributor link
    'a[href*="contrib"]',           // Google Maps contributor link
    'a[href*="/maps/contrib/"]',    // Another Maps pattern
  ];

  for (const sel of nameSelectors) {
    const el = container.querySelector(sel);
    if (el) {
      reviewerName = el.textContent?.trim();
      break;
    }
  }

  // Fallback: look for a short, bold text element near the top (the name)
  if (!reviewerName) {
    // In Google Maps, the name is often in a <button> or <div> with role
    const candidates = container.querySelectorAll(
      "button, a, strong, b, [role='heading'], h3, h4"
    );
    for (const el of candidates) {
      const name = el.textContent?.trim();
      if (
        name &&
        name.length > 1 &&
        name.length < 40 &&
        !name.toLowerCase().includes("reply") &&
        !name.toLowerCase().includes("star") &&
        !name.toLowerCase().includes("review") &&
        !name.toLowerCase().includes("helpful") &&
        !name.toLowerCase().includes("flag") &&
        !name.toLowerCase().includes("like") &&
        !name.toLowerCase().includes("more") &&
        !name.toLowerCase().includes("response")
      ) {
        reviewerName = name;
        break;
      }
    }
  }

  // ── Extract review text ────────────────────
  let reviewText = null;

  // Google Maps uses a specific class for review text (wiI7pd),
  // but class names can change. We try it first, then fall back.

  // Strategy 1: Find .review-text p or span (test page and some Maps versions)
  const reviewTextEl = container.querySelector(".review-text p, .review-text span, .review-text");
  if (reviewTextEl) {
    const text = reviewTextEl.textContent?.trim();
    if (text && text.length > 15) reviewText = text;
  }

  // Strategy 2: Find the longest suitable text block that isn't the reviewer name
  if (!reviewText) {
    const textElements = container.querySelectorAll("span, p, div");
    let longestText = "";

    textElements.forEach((el) => {
      const elText = el.textContent?.trim() || "";
      // Review text is typically the longest text block that:
      // - Is longer than what we have so far
      // - Is at least 15 chars (not a label or name)
      // - Is under 5000 chars (not the entire container)
      // - Doesn't contain common non-review words
      // - Is a leaf-ish node (< 3 direct children)
      if (
        elText.length > longestText.length &&
        elText.length > 15 &&
        elText.length < 5000 &&
        el.children.length < 5 &&
        !elText.includes("stars") &&
        elText !== reviewerName
      ) {
        longestText = elText;
      }
    });

    if (longestText) reviewText = longestText;
  }

  // Need at least some review content to generate a reply
  if (!reviewText && !starRating) return null;

  return {
    reviewText: reviewText || "(No text review — rating only)",
    reviewerName: reviewerName || "the customer",
    starRating: starRating || 3,
  };
}

// ─── Find the reply textarea/button in or near a container ─
function findReplyArea(container) {
  // Look for an existing textarea (reply box already open)
  const textarea = container.querySelector(
    'textarea, [contenteditable="true"], [role="textbox"]'
  );
  if (textarea) return textarea;

  // Look for a "Reply" button within the container
  const buttons = container.querySelectorAll("button, [role='button']");
  for (const btn of buttons) {
    const btnText = btn.textContent?.trim().toLowerCase() || "";
    if (btnText === "reply" || btnText === "respond") {
      return btn;
    }
  }

  // Google Maps: the reply button might be a sibling of the review container
  const nextSibling = container.nextElementSibling;
  if (nextSibling) {
    const siblingBtn = nextSibling.querySelector("button, [role='button']");
    if (siblingBtn) {
      const btnText = siblingBtn.textContent?.trim().toLowerCase() || "";
      if (btnText === "reply" || btnText === "respond") {
        return siblingBtn;
      }
    }
  }

  return null;
}

// ─── Inject the Generate Reply button ────────
function injectGenerateButton(container, reviewData) {
  const wrapper = document.createElement("div");
  wrapper.className = "rr-button-wrapper";

  const btn = document.createElement("button");
  btn.className = "rr-generate-btn";
  btn.innerHTML = '✨ <span>Generate Reply</span>';
  btn.title = "Generate an AI reply with ReviewReply AI";

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleGenerate(btn, container, reviewData);
  });

  wrapper.appendChild(btn);

  // ── Decide where to place the button ──────
  // Priority 1: insert above an existing reply textarea
  const textarea = container.querySelector(
    'textarea, [contenteditable="true"], [role="textbox"]'
  );
  if (textarea) {
    textarea.parentElement.insertBefore(wrapper, textarea);
    return;
  }

  // Priority 2: insert after the reply-section label but before textarea
  const replySection = container.querySelector(".reply-section");
  if (replySection) {
    const label = replySection.querySelector("label");
    if (label) {
      label.after(wrapper);
      return;
    }
    replySection.prepend(wrapper);
    return;
  }

  // Priority 3: insert next to a reply/respond button
  const replyBtn = findReplyButtonOnly(container);
  if (replyBtn) {
    replyBtn.parentElement.insertBefore(wrapper, replyBtn.nextSibling);
    return;
  }

  // Priority 4: append at the bottom of the review container
  container.appendChild(wrapper);
}

// Helper: find just a Reply button (not textarea)
function findReplyButtonOnly(container) {
  const buttons = container.querySelectorAll("button, [role='button']");
  for (const btn of buttons) {
    const btnText = btn.textContent?.trim().toLowerCase() || "";
    if (btnText === "reply" || btnText === "respond") {
      return btn;
    }
  }
  return null;
}

// ─── Handle Generate button click ────────────
async function handleGenerate(btn, container, reviewData) {
  // Check for auth token
  const { rr_token } = await chrome.storage.local.get(["rr_token"]);
  if (!rr_token) {
    showToast("Please log in via the ReviewReply extension popup first", "warning");
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

    // Try to insert reply into the reply textarea
    const inserted = await insertReplyText(container, data.reply);

    if (inserted) {
      btn.innerHTML = '↻ <span>Regenerate</span>';
      btn.classList.remove("rr-loading");
      btn.classList.add("rr-regenerate");
      btn.disabled = false;
      showToast("Reply generated! Review it and hit Send.", "success");
    } else {
      // Even if we can't find a textarea, show the reply in a toast/overlay
      // so the user can still copy it
      showReplyOverlay(container, data.reply);
      btn.innerHTML = '↻ <span>Regenerate</span>';
      btn.classList.remove("rr-loading");
      btn.classList.add("rr-regenerate");
      btn.disabled = false;
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
async function insertReplyText(container, text) {
  // First, check if there's already a textarea open
  let textarea = container.querySelector(
    'textarea, [contenteditable="true"], [role="textbox"]'
  );

  // If no textarea, try clicking a Reply button to open one
  if (!textarea) {
    const replyBtn = findReplyButtonOnly(container);
    if (replyBtn) {
      replyBtn.click();

      // Wait for textarea to appear (Google Maps animates the reply box)
      textarea = await waitForElement(
        container,
        'textarea, [contenteditable="true"], [role="textbox"]',
        3000
      );
    }

    // Also check siblings (Google Maps sometimes puts the reply area outside the review container)
    if (!textarea) {
      const nextEl = container.nextElementSibling;
      if (nextEl) {
        textarea = nextEl.querySelector(
          'textarea, [contenteditable="true"], [role="textbox"]'
        );
      }
    }
  }

  if (!textarea) return false;

  setTextareaValue(textarea, text);
  return true;
}

// ─── Wait for an element to appear ───────────
function waitForElement(parent, selector, timeout = 3000) {
  return new Promise((resolve) => {
    // Check immediately
    const existing = parent.querySelector(selector);
    if (existing) return resolve(existing);

    let resolved = false;

    const observer = new MutationObserver(() => {
      const el = parent.querySelector(selector);
      if (el && !resolved) {
        resolved = true;
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(parent, { childList: true, subtree: true });

    // Also observe the parent's parent (reply area might be a sibling)
    if (parent.parentElement) {
      const siblingObserver = new MutationObserver(() => {
        const nextEl = parent.nextElementSibling;
        if (nextEl) {
          const el = nextEl.querySelector(selector);
          if (el && !resolved) {
            resolved = true;
            siblingObserver.disconnect();
            observer.disconnect();
            resolve(el);
          }
        }
      });
      siblingObserver.observe(parent.parentElement, { childList: true, subtree: true });

      setTimeout(() => {
        siblingObserver.disconnect();
      }, timeout);
    }

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        observer.disconnect();
        resolve(null);
      }
    }, timeout);
  });
}

// ─── Set textarea value and trigger change detection ───
function setTextareaValue(textarea, text) {
  if (textarea.tagName === "TEXTAREA" || textarea.tagName === "INPUT") {
    // Use the native setter to bypass React/Angular synthetic events
    const nativeInputValueSetter =
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set ||
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(textarea, text);
    } else {
      textarea.value = text;
    }

    // Fire events so the framework detects the change
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  } else if (
    textarea.getAttribute("contenteditable") === "true" ||
    textarea.getAttribute("role") === "textbox"
  ) {
    textarea.focus();
    textarea.textContent = text;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  }

  textarea.focus();
}

// ─── Show reply in a copy-able overlay (fallback) ───
function showReplyOverlay(container, replyText) {
  // Remove existing overlay in this container if any
  const existing = container.querySelector(".rr-reply-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "rr-reply-overlay";
  overlay.innerHTML = `
    <div class="rr-reply-overlay-header">
      <span>✨ Generated Reply</span>
      <button class="rr-copy-btn" title="Copy to clipboard">📋 Copy</button>
    </div>
    <div class="rr-reply-overlay-text">${escapeHtml(replyText)}</div>
  `;

  // Copy button handler
  overlay.querySelector(".rr-copy-btn").addEventListener("click", () => {
    navigator.clipboard.writeText(replyText).then(() => {
      showToast("Reply copied to clipboard!", "success");
    });
  });

  container.appendChild(overlay);
  showToast("Reply generated! Copy it and paste into the reply box.", "success");
}

// ─── Escape HTML for safe insertion ──────────
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ─── Toast Notification ──────────────────────
function showToast(message, type = "info", linkUrl = null) {
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

  requestAnimationFrame(() => {
    toast.classList.add("rr-toast-visible");
  });

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
