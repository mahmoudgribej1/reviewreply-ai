import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getActiveSubscriptionByEmail,
  getCompletedOrderByEmail,
} from "@/lib/lemonsqueezy";

/**
 * POST /api/lemonsqueezy/verify-upgrade
 *
 * Called by the dashboard client when the user lands with ?upgraded=true
 * but their plan is still FREE (webhook hasn't fired yet or failed).
 *
 * Queries LemonSqueezy's API directly to find an active subscription or
 * paid order for this user's email, and upgrades the DB record if found.
 *
 * Returns:
 *   { upgraded: true }  → plan was just upgraded
 *   { upgraded: false } → no active subscription found yet
 */
export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Already PRO — nothing to do
  if (user.plan === "PRO") {
    return NextResponse.json({ upgraded: true, alreadyPro: true });
  }

  // ─── Check for active subscription ───────────
  const sub = await getActiveSubscriptionByEmail(email);

  if (sub) {
    await prisma.user.update({
      where: { email },
      data: {
        plan: "PRO",
        lsSubscriptionId: sub.subscriptionId,
        lsCustomerId: sub.customerId,
        lsVariantId: sub.variantId,
      },
    });
    console.log("[VERIFY_UPGRADE] Upgraded via subscription:", email);
    return NextResponse.json({ upgraded: true });
  }

  // ─── Fallback: check for paid order ──────────
  const order = await getCompletedOrderByEmail(email);

  if (order) {
    await prisma.user.update({
      where: { email },
      data: {
        plan: "PRO",
        lsCustomerId: order.customerId,
      },
    });
    console.log("[VERIFY_UPGRADE] Upgraded via order:", email);
    return NextResponse.json({ upgraded: true });
  }

  // No active purchase found yet
  console.log("[VERIFY_UPGRADE] No active purchase found for:", email);
  return NextResponse.json({ upgraded: false });
}
