import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyExtensionToken } from "@/lib/jwt";
import { createCheckout } from "@/lib/lemonsqueezy";

/**
 * POST /api/lemonsqueezy/checkout
 *
 * Creates a LemonSqueezy hosted checkout session.
 * Returns { checkoutUrl } — the frontend opens this in a new tab.
 *
 * Auth: Bearer token (extension) or NextAuth session (dashboard)
 */
export async function POST(request: Request) {
  try {
    // ─── Resolve current user ────────────────
    let userEmail: string | null = null;

    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = verifyExtensionToken(token);
      if (payload) userEmail = payload.email;
    }

    if (!userEmail) {
      const session = await getServerSession(authOptions);
      console.log("[CHECKOUT] session:", JSON.stringify(session?.user ?? null));
      userEmail = session?.user?.email ?? null;
    }

    if (!userEmail) {
      console.log("[CHECKOUT] No user email found — returning 401");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ─── Fetch user ──────────────────────────
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    console.log("[CHECKOUT] user plan:", user?.plan ?? "not found");

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Already on Pro — no need to create another checkout
    if (user.plan === "PRO") {
      return NextResponse.json(
        { error: "Already on Pro plan" },
        { status: 400 }
      );
    }

    // ─── Create checkout URL ─────────────────
    const checkoutUrl = await createCheckout({
      userEmail: user.email,
      userId: user.id,
    });

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error("[CHECKOUT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }
}
