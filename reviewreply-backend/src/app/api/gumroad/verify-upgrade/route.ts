import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveSubscriberByEmail } from "@/lib/gumroad";

/**
 * POST /api/gumroad/verify-upgrade
 *
 * Called by the dashboard client when the user lands with ?upgraded=true
 * but their plan is still FREE (webhook hasn't fired yet or failed).
 *
 * Queries Gumroad's API directly to find an active subscription for
 * this user's email, and upgrades the DB record if found.
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
  const sub = await getActiveSubscriberByEmail(email);

  if (sub) {
    await prisma.user.update({
      where: { email },
      data: {
        plan: "PRO",
        gumroadSubscriptionId: sub.subscriptionId,
        gumroadSaleId: sub.saleId,
      },
    });
    console.log("[VERIFY_UPGRADE] Upgraded via Gumroad subscription:", email);
    return NextResponse.json({ upgraded: true });
  }

  // No active purchase found yet
  console.log("[VERIFY_UPGRADE] No active Gumroad purchase found for:", email);
  return NextResponse.json({ upgraded: false });
}
