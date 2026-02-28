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
    throw new Error("Failed to fetch subscription from LemonSqueezy");
  }

  const data = await response.json();
  return data.data.attributes.urls.customer_portal as string;
}
