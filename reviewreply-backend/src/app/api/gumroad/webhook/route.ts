import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/gumroad/webhook
 *
 * Receives Gumroad "ping" events and updates the DB accordingly.
 * Gumroad sends form-encoded POST data (not JSON).
 *
 * Events handled (via resource_name field):
 *  - sale                     → plan = PRO
 *  - subscription_restarted   → plan = PRO
 *  - cancellation             → plan = FREE
 *  - subscription_ended       → plan = FREE
 *  - refund                   → plan = FREE
 *
 * Verification: We check seller_id matches our own and optionally
 * verify the product permalink. Gumroad pings don't use HMAC.
 */

// Health-check
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "gumroad-webhook" });
}

export async function POST(request: Request) {
  console.log("[WEBHOOK] ─── Incoming Gumroad ping ───");

  // ─── 1. Parse form-encoded body ───────────
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);

  console.log("[WEBHOOK] Body length:", rawBody.length);

  const resourceName = params.get("resource_name") ?? "sale";
  const sellerId = params.get("seller_id") ?? "";
  const productPermalink = params.get("product_permalink") ?? params.get("permalink") ?? "";
  const email = params.get("email") ?? "";
  const saleId = params.get("sale_id") ?? "";
  const subscriptionId = params.get("subscription_id") ?? "";
  const orderNumber = params.get("order_number") ?? "";

  // URL params from checkout (our custom user_id)
  const userId = params.get("url_params[user_id]") ?? "";

  console.log("[WEBHOOK] Event:", resourceName);
  console.log("[WEBHOOK] email:", email, "userId:", userId);
  console.log("[WEBHOOK] saleId:", saleId, "subscriptionId:", subscriptionId);
  console.log("[WEBHOOK] seller_id:", sellerId, "permalink:", productPermalink, "order:", orderNumber);

  // ─── 2. Verify ping origin ────────────────
  const expectedSellerId = process.env.GUMROAD_SELLER_ID ?? "";
  const expectedPermalink = process.env.GUMROAD_PRODUCT_PERMALINK ?? "";

  if (expectedSellerId && sellerId !== expectedSellerId) {
    console.warn("[WEBHOOK] seller_id mismatch:", sellerId, "expected:", expectedSellerId);
    return NextResponse.json({ error: "Invalid seller" }, { status: 403 });
  }

  if (expectedPermalink && productPermalink && productPermalink !== expectedPermalink) {
    console.warn("[WEBHOOK] product mismatch:", productPermalink, "expected:", expectedPermalink);
    return NextResponse.json({ error: "Wrong product" }, { status: 400 });
  }

  // ─── 3. Resolve user ─────────────────────
  let user = null;

  // Try finding by custom user_id first (most reliable)
  if (userId) {
    user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) console.log("[WEBHOOK] Found user by userId:", user.email);
  }

  // Fallback: by email
  if (!user && email) {
    user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (user) console.log("[WEBHOOK] Found user by email:", user.email);
  }

  if (!user) {
    console.warn("[WEBHOOK] ⚠ User not found for email:", email, "id:", userId);
    // Return 200 so Gumroad doesn't keep retrying
    return NextResponse.json({ received: true });
  }

  // ─── 4. Handle event ─────────────────────
  try {
    switch (resourceName) {
      case "sale":
      case "subscription_restarted": {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: "PRO",
            gumroadSaleId: saleId || null,
            gumroadSubscriptionId: subscriptionId || null,
          },
        });
        console.log("[WEBHOOK] ✓ Upgraded user to PRO:", user.email);
        break;
      }

      case "cancellation":
      case "subscription_ended":
      case "refund": {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: "FREE",
            gumroadSubscriptionId: null,
          },
        });
        console.log("[WEBHOOK] ✓ Downgraded user to FREE:", user.email);
        break;
      }

      default:
        console.log("[WEBHOOK] Unhandled event, ignoring:", resourceName);
    }
  } catch (dbError) {
    console.error("[WEBHOOK] DB update failed:", dbError);
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
