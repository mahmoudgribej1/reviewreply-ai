import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyExtensionToken } from "@/lib/jwt";
import { getCustomerPortalUrl } from "@/lib/lemonsqueezy";

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

    if (!user.lsSubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    // ─── Get portal URL ───────────────────────────
    const portalUrl = await getCustomerPortalUrl(user.lsSubscriptionId);

    return NextResponse.json({ portalUrl });
  } catch (error) {
    console.error("[PORTAL_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to retrieve billing portal" },
      { status: 500 }
    );
  }
}
