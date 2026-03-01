import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyExtensionToken } from "@/lib/jwt";
import { FREE_GENERATION_LIMIT } from "@/lib/constants";

/**
 * GET /api/me
 *
 * Works with two auth methods:
 * 1. NextAuth session cookie (web dashboard)
 * 2. Bearer token in Authorization header (Chrome extension)
 */
export async function GET(request: Request) {
  try {
    let userEmail: string | null = null;

    // ─── Try Bearer token first (extension) ──
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = verifyExtensionToken(token);
      if (payload) {
        userEmail = payload.email;
      }
    }

    // ─── Fall back to NextAuth session (web) ──
    if (!userEmail) {
      const session = await getServerSession(authOptions);
      userEmail = session?.user?.email ?? null;
    }

    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ─── Fetch user with profile ──────────────
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { businessProfile: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        generationsUsed: user.generationsUsedThisMonth,
        generationsLimit:
          user.plan === "PRO" ? "unlimited" : FREE_GENERATION_LIMIT,
        hasBusinessProfile: !!user.businessProfile,
        businessProfile: user.businessProfile
          ? {
              businessName: user.businessProfile.businessName,
              businessType: user.businessProfile.businessType,
              ownerFirstName: user.businessProfile.ownerFirstName,
              tone: user.businessProfile.tone,
            }
          : null,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("[ME_ERROR]", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
