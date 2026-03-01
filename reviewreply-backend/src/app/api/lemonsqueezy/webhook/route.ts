import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/lemonsqueezy/webhook
 *
 * Receives LemonSqueezy subscription lifecycle events and updates the DB.
 *
 * Events handled:
 *  - subscription_created   → plan = PRO
 *  - subscription_updated   → plan = PRO (ensure idempotent)
 *  - subscription_cancelled / subscription_expired → plan = FREE
 *  - order_created          → plan = PRO (one-time purchase fallback)
 *
 * Verification: HMAC-SHA256 over raw body using LEMONSQUEEZY_WEBHOOK_SECRET.
 * In development (secret is empty), signature verification is skipped.
 *
 * No auth beyond signature — this is a server-to-server call from LS.
 */

// Simple health-check so you can verify the endpoint is reachable (GET)
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "lemonsqueezy-webhook" });
}
export async function POST(request: Request) {
  console.log("[WEBHOOK] ─── Incoming webhook request ───");

  // ─── 1. Read raw body (needed for HMAC) ──────
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") ?? request.headers.get("X-Signature");

  console.log("[WEBHOOK] Body length:", rawBody.length);
  console.log("[WEBHOOK] Signature present:", !!signature);

  // ─── 2. Verify signature (skip if no secret configured) ────
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "";

  if (secret) {
    // Secret is configured — verify signature
    if (!signature) {
      console.warn("[WEBHOOK] Missing signature header — rejecting");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSig, "hex"),
        Buffer.from(signature, "hex")
      );
      if (!isValid) {
        console.warn("[WEBHOOK] Signature mismatch");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } catch {
      // timingSafeEqual throws if buffers are different lengths
      console.warn("[WEBHOOK] Signature verification failed (length mismatch)");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    console.log("[WEBHOOK] Signature verified ✓");
  } else {
    console.warn("[WEBHOOK] ⚠ No webhook secret configured — skipping signature verification (dev mode)");
  }

  // ─── 3. Parse payload ─────────────────────────
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    console.error("[WEBHOOK] Failed to parse JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const meta = event.meta as Record<string, unknown> | undefined;
  const eventName = meta?.event_name as string | undefined;

  const data = event.data as Record<string, unknown> | undefined;
  const attributes = data?.attributes as Record<string, unknown> | undefined;

  if (!eventName || !data || !attributes) {
    console.error("[WEBHOOK] Unexpected payload shape:", {
      hasEventName: !!eventName,
      hasData: !!data,
      hasAttributes: !!attributes,
    });
    // Log a snippet of the raw body for debugging
    console.error("[WEBHOOK] Raw body preview:", rawBody.substring(0, 500));
    return NextResponse.json({ error: "Unexpected payload shape" }, { status: 400 });
  }

  console.log("[WEBHOOK] Event:", eventName);

  // ─── 4. Resolve user ─────────────────────────
  // LemonSqueezy puts the buyer's email in attributes.user_email
  // and our custom_data.user_id (set during checkout) inside meta.custom_data
  const userEmail = attributes.user_email as string | undefined;
  const customData = meta?.custom_data as Record<string, string> | undefined;
  const userId = customData?.user_id;

  // Also check checkout custom data (for order_created events)
  const firstOrderItem = (attributes.first_order_item as Record<string, unknown>) ?? {};
  const checkoutCustom = (firstOrderItem.custom_data ?? customData) as Record<string, string> | undefined;

  console.log("[WEBHOOK] userEmail:", userEmail, "userId:", userId);
  console.log("[WEBHOOK] customData:", JSON.stringify(customData));

  let user = null;

  // Try finding by custom user_id first (most reliable)
  if (userId) {
    user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) console.log("[WEBHOOK] Found user by userId:", user.email);
  }

  // Fallback: by custom_data user_id from checkout
  if (!user && checkoutCustom?.user_id) {
    user = await prisma.user.findUnique({ where: { id: checkoutCustom.user_id } });
    if (user) console.log("[WEBHOOK] Found user by checkout custom data:", user.email);
  }

  // Fallback: by email
  if (!user && userEmail) {
    user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (user) console.log("[WEBHOOK] Found user by email:", user.email);
  }

  if (!user) {
    console.warn("[WEBHOOK] ⚠ User not found for email:", userEmail, "id:", userId);
    // Return 200 so LemonSqueezy doesn't keep retrying with an unfindable event
    return NextResponse.json({ received: true });
  }

  // ─── 5. Handle event ─────────────────────────
  const lsSubscriptionId = String(data.id ?? "");
  const lsCustomerId = String(attributes.customer_id ?? "");
  const lsVariantId = String(attributes.variant_id ?? "");

  try {
    switch (eventName) {
      case "subscription_created":
      case "subscription_updated":
      case "order_created": {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: "PRO",
            lsCustomerId: lsCustomerId || null,
            lsSubscriptionId: lsSubscriptionId || null,
            lsVariantId: lsVariantId || null,
          },
        });
        console.log("[WEBHOOK] ✓ Upgraded user to PRO:", user.email);
        break;
      }

      case "subscription_cancelled":
      case "subscription_expired": {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: "FREE",
            lsSubscriptionId: null,
            lsVariantId: null,
          },
        });
        console.log("[WEBHOOK] ✓ Downgraded user to FREE:", user.email);
        break;
      }

      default:
        console.log("[WEBHOOK] Unhandled event, ignoring:", eventName);
    }
  } catch (dbError) {
    console.error("[WEBHOOK] DB update failed:", dbError);
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
