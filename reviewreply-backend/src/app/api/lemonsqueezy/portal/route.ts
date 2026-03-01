import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyExtensionToken } from "@/lib/jwt";
import { getCustomerPortalUrl, getActiveSubscriptionByEmail } from "@/lib/lemonsqueezy";

/**
 * POST /api/lemonsqueezy/portal
 *
 * Returns a one-time customer portal URL so the user can manage their
 * LemonSqueezy subscription (change plan, cancel, update payment info).
 *
 * Returns { portalUrl } — the frontend opens this in a new tab.
 *
 * Auth: Bearer token (extension) or NextAuth session (dashboard)
 */
export async function POST(request: Request) {
  try {
    // ─── Resolve current user ─────────────────────
    let userEmail: string | null = null;

    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = verifyExtensionToken(token);
      if (payload) userEmail = payload.email;
    }

    if (!userEmail) {
      const session = await getServerSession(authOptions);
      userEmail = session?.user?.email ?? null;
    }

    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ─── Fetch user ───────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ─── Resolve subscription ID ──────────────────
    // If we don't have a subscriptionId stored (upgrade via order fallback),
    // re-query LemonSqueezy to find and save it now.
    let subscriptionId = user.lsSubscriptionId;

    if (!subscriptionId) {
      // Try to find subscription from LS API
      const sub = await getActiveSubscriptionByEmail(userEmail);
      if (sub) {
        // Save it for next time
        await prisma.user.update({
          where: { email: userEmail },
          data: {
            lsSubscriptionId: sub.subscriptionId,
            lsCustomerId: sub.customerId,
            lsVariantId: sub.variantId,
          },
        });
        subscriptionId = sub.subscriptionId;
      }
    }

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found. If you just upgraded, please wait a moment and try again." },
        { status: 400 }
      );
    }

    // ─── Get portal URL ───────────────────────────
    const portalUrl = await getCustomerPortalUrl(subscriptionId);

    return NextResponse.json({ portalUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PORTAL_ERROR]", message);

    // LemonSqueezy stores in test mode / not yet activated return errors
    // for the portal URL endpoint. Surface a helpful message.
    if (message.includes("Failed to fetch subscription")) {
      return NextResponse.json(
        { error: "Billing portal is not available yet. If your store is in test mode, activate it on LemonSqueezy first." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to retrieve billing portal" },
      { status: 500 }
    );
  }
}
