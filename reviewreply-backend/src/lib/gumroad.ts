// ─────────────────────────────────────────────
// Gumroad API helpers
// Using native fetch — no SDK required
// Docs: https://app.gumroad.com/api
// ─────────────────────────────────────────────

const GUMROAD_API = "https://api.gumroad.com/v2";

function gumroadHeaders() {
  return {
    Authorization: `Bearer ${process.env.GUMROAD_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

// ─── Build checkout URL ─────────────────────
// Gumroad uses a hosted product page — no API-created checkout.
// We redirect to the product page with the buyer's email pre-filled
// and pass the internal user ID via URL params so the webhook can match.
export function buildCheckoutUrl({
  userEmail,
  userId,
}: {
  userEmail: string;
  userId: string;
}): string {
  const productUrl = process.env.GUMROAD_PRODUCT_URL!;
  const url = new URL(productUrl);
  url.searchParams.set("email", userEmail);
  url.searchParams.set("user_id", userId);
  // "wanted=true" auto-opens the overlay checkout on page load
  url.searchParams.set("wanted", "true");
  return url.toString();
}

// ─── Check if user has active subscription ──
// Queries Gumroad subscribers list for the product.
export async function getActiveSubscriberByEmail(
  email: string
): Promise<{ subscriptionId: string; saleId: string } | null> {
  const productPermalink = process.env.GUMROAD_PRODUCT_PERMALINK!;

  const response = await fetch(
    `${GUMROAD_API}/products/${productPermalink}/subscribers?email=${encodeURIComponent(email)}`,
    { headers: gumroadHeaders() }
  );

  if (!response.ok) {
    console.error("[GUMROAD] Subscribers fetch failed:", response.status);
    return null;
  }

  const data = await response.json();

  if (!data.success || !data.subscribers?.length) return null;

  // Find an active ("alive") subscriber
  const active = data.subscribers.find(
    (s: Record<string, unknown>) => s.status === "alive"
  );

  if (!active) return null;

  return {
    subscriptionId: String(active.id),
    saleId: String(active.sale_id ?? ""),
  };
}

// ─── Verify a sale by ID ────────────────────
// Used to double-check a webhook ping is legitimate.
export async function verifySale(
  saleId: string
): Promise<{ valid: boolean; email?: string; productPermalink?: string }> {
  const response = await fetch(`${GUMROAD_API}/sales/${saleId}`, {
    headers: gumroadHeaders(),
  });

  if (!response.ok) return { valid: false };

  const data = await response.json();
  if (!data.success) return { valid: false };

  return {
    valid: true,
    email: data.sale?.email,
    productPermalink: data.sale?.product_permalink,
  };
}

// ─── Get subscriber management URL ──────────
// Gumroad provides a page where the subscriber can cancel / manage.
export async function getSubscriberManagementUrl(
  subscriptionId: string
): Promise<string | null> {
  const response = await fetch(
    `${GUMROAD_API}/subscribers/${subscriptionId}`,
    { headers: gumroadHeaders() }
  );

  if (!response.ok) {
    console.error("[GUMROAD] Subscriber fetch failed:", response.status);
    return null;
  }

  const data = await response.json();
  if (!data.success || !data.subscriber) return null;

  // Gumroad returns manage_url or the subscriber page URL
  return (data.subscriber.manage_url as string) ?? null;
}
