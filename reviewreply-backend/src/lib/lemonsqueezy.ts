// ─────────────────────────────────────────────
// LemonSqueezy API helpers
// Using native fetch — no SDK required
// Docs: https://docs.lemonsqueezy.com/api
// ─────────────────────────────────────────────

const LS_API_BASE = "https://api.lemonsqueezy.com/v1";

function lsHeaders() {
  return {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
  };
}

// ─── Create a checkout session ───────────────
// Returns the hosted checkout URL to redirect the user to
export async function createCheckout({
  userEmail,
  userId,
}: {
  userEmail: string;
  userId: string;
}): Promise<string> {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID!;
  const variantId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID!;

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        // Pre-fill the customer's email so they don't have to type it
        checkout_data: {
          email: userEmail,
          // Pass user ID in custom data so the webhook can match them
          custom: {
            user_id: userId,
          },
        },
        // Redirect back to dashboard after payment
        product_options: {
          redirect_url: `${process.env.NEXTAUTH_URL}/dashboard?upgraded=true`,
        },
      },
      relationships: {
        store: {
          data: { type: "stores", id: storeId },
        },
        variant: {
          data: { type: "variants", id: variantId },
        },
      },
    },
  };

  const response = await fetch(`${LS_API_BASE}/checkouts`, {
    method: "POST",
    headers: lsHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LemonSqueezy checkout failed: ${error}`);
  }

  const data = await response.json();
  return data.data.attributes.url as string;
}

// ─── Check if a user has an active subscription ─
// Queries LS API by email + store ID.
// Returns the subscription object or null.
export async function getActiveSubscriptionByEmail(
  email: string
): Promise<{ subscriptionId: string; customerId: string; variantId: string } | null> {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID!;

  const url = `${LS_API_BASE}/subscriptions?filter[store_id]=${storeId}&filter[user_email]=${encodeURIComponent(email)}`;
  const response = await fetch(url, { headers: lsHeaders() });

  if (!response.ok) return null;

  const data = await response.json();
  const subs = data.data as Array<Record<string, unknown>>;

  // Find any active/on-trial subscription
  const active = subs.find((s) => {
    const attrs = s.attributes as Record<string, unknown>;
    return ["active", "on_trial"].includes(attrs.status as string);
  });

  if (!active) return null;

  const attrs = active.attributes as Record<string, unknown>;
  return {
    subscriptionId: String(active.id),
    customerId: String(attrs.customer_id ?? ""),
    variantId: String(attrs.variant_id ?? ""),
  };
}

// ─── Check if a user has a completed order ───
// Fallback for one-time purchases / when subscription endpoint is empty.
export async function getCompletedOrderByEmail(
  email: string
): Promise<{ orderId: string; customerId: string } | null> {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID!;

  const url = `${LS_API_BASE}/orders?filter[store_id]=${storeId}&filter[user_email]=${encodeURIComponent(email)}`;
  const response = await fetch(url, { headers: lsHeaders() });

  if (!response.ok) return null;

  const data = await response.json();
  const orders = data.data as Array<Record<string, unknown>>;

  const paid = orders.find((o) => {
    const attrs = o.attributes as Record<string, unknown>;
    return attrs.status === "paid";
  });

  if (!paid) return null;

  const attrs = paid.attributes as Record<string, unknown>;
  return {
    orderId: String(paid.id),
    customerId: String(attrs.customer_id ?? ""),
  };
}

// ─── Get customer portal URL ────────────────
// Lets existing subscribers manage/cancel their sub
export async function getCustomerPortalUrl(
  lsSubscriptionId: string
): Promise<string> {
  const response = await fetch(
    `${LS_API_BASE}/subscriptions/${lsSubscriptionId}`,
    {
      headers: lsHeaders(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[LS_PORTAL] Subscription fetch failed:", response.status, errorText);
    throw new Error(`Failed to fetch subscription from LemonSqueezy: ${response.status}`);
  }

  const data = await response.json();
  const portalUrl = data.data?.attributes?.urls?.customer_portal;

  if (!portalUrl) {
    console.error("[LS_PORTAL] No customer_portal URL in response:", JSON.stringify(data.data?.attributes?.urls));
    throw new Error("LemonSqueezy did not return a portal URL. Your store may need to be activated.");
  }

  return portalUrl as string;
}
