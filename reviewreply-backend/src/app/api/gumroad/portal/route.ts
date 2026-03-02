import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyExtensionToken } from "@/lib/jwt";
import {
  getSubscriberManagementUrl,
  getActiveSubscriberByEmail,
} from "@/lib/gumroad";

/**
 * POST /api/gumroad/portal
 *
 * Returns a Gumroad subscriber management URL so the user can
 * manage/cancel their subscription.
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
    let subscriptionId = user.gumroadSubscriptionId;

    if (!subscriptionId) {
      // Try to find subscription from Gumroad API
      const sub = await getActiveSubscriberByEmail(userEmail);
      if (sub) {
        // Save it for next time
        await prisma.user.update({
          where: { email: userEmail },
          data: {
            gumroadSubscriptionId: sub.subscriptionId,
            gumroadSaleId: sub.saleId,
          },
        });
        subscriptionId = sub.subscriptionId;
      }
    }

    if (!subscriptionId) {
      return NextResponse.json(
        {
          error:
            "No active subscription found. If you just upgraded, please wait a moment and try again.",
        },
        { status: 400 }
      );
    }

    // ─── Get management URL ───────────────────────
    const portalUrl = await getSubscriberManagementUrl(subscriptionId);

    if (!portalUrl) {
      return NextResponse.json(
        { error: "Could not retrieve subscription management page." },
        { status: 503 }
      );
    }

    return NextResponse.json({ portalUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PORTAL_ERROR]", message);
    return NextResponse.json(
      { error: "Failed to retrieve billing portal" },
      { status: 500 }
    );
  }
}
