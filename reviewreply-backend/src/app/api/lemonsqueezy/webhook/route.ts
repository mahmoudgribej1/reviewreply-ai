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
 *
 * Verification: HMAC-SHA256 over raw body using LEMONSQUEEZY_WEBHOOK_SECRET
 * compared against the x-signature header sent by LemonSqueezy.
 *
 * No auth beyond signature — this is a server-to-server call from LS.
 */
export async function POST(request: Request) {
  // ─── 1. Read raw body (needed for HMAC) ──────
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // ─── 2. Verify signature ──────────────────────
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "";
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(expectedSig, "hex"),
      Buffer.from(signature, "hex")
    )
  ) {
    console.warn("[WEBHOOK] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ─── 3. Parse payload ─────────────────────────
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = event.meta
    ? (event.meta as Record<string, unknown>).event_name as string
    : null;

  const data = event.data as Record<string, unknown> | undefined;
  const attributes = data?.attributes as Record<string, unknown> | undefined;

  if (!eventName || !data || !attributes) {
    return NextResponse.json({ error: "Unexpected payload shape" }, { status: 400 });
  }

  console.log("[WEBHOOK] Event:", eventName);

  // ─── 4. Resolve user ─────────────────────────
  // LemonSqueezy puts the buyer's email in attributes.user_email
  // and our custom_data.user_id (set during checkout) inside meta.custom_data
  const userEmail = attributes.user_email as string | undefined;
  const customData = (event.meta as Record<string, unknown>)
    ?.custom_data as Record<string, string> | undefined;
  const userId = customData?.user_id;

  let user = null;

  if (userId) {
    user = await prisma.user.findUnique({ where: { id: userId } });
  }

  if (!user && userEmail) {
    user = await prisma.user.findUnique({ where: { email: userEmail } });
  }

  if (!user) {
    console.warn("[WEBHOOK] User not found for email:", userEmail, "id:", userId);
    // Return 200 so LemonSqueezy doesn't keep retrying with an unfindable event
    return NextResponse.json({ received: true });
  }

  // ─── 5. Handle event ─────────────────────────
  const lsSubscriptionId = String(data.id);
  const lsCustomerId = String(attributes.customer_id ?? "");
  const lsVariantId = String(attributes.variant_id ?? "");

  switch (eventName) {
    case "subscription_created":
    case "subscription_updated": {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: "PRO",
          lsCustomerId: lsCustomerId || null,
          lsSubscriptionId: lsSubscriptionId || null,
          lsVariantId: lsVariantId || null,
        },
      });
      console.log("[WEBHOOK] Upgraded user to PRO:", user.email);
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
      console.log("[WEBHOOK] Downgraded user to FREE:", user.email);
      break;
    }

    default:
      console.log("[WEBHOOK] Unhandled event, ignoring:", eventName);
  }

  return NextResponse.json({ received: true });
}
