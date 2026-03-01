import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signExtensionToken } from "@/lib/jwt";
import { FREE_GENERATION_LIMIT } from "@/lib/constants";

/**
 * GET /api/auth/extension-token
 *
 * Issues a JWT for the Chrome extension based on the current
 * NextAuth session cookie.  This allows users who log in on the
 * web to be automatically logged into the extension as well.
 *
 * Auth: NextAuth session cookie only (no Bearer token).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businessProfile: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const token = signExtensionToken({
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({
      token,
      user: {
        name: user.name,
        businessName: user.businessProfile?.businessName ?? null,
        ownerFirstName: user.businessProfile?.ownerFirstName ?? null,
        plan: user.plan,
        generationsUsed: user.generationsUsedThisMonth,
        generationsLimit:
          user.plan === "PRO" ? "unlimited" : FREE_GENERATION_LIMIT,
        hasBusinessProfile: !!user.businessProfile,
      },
    });
  } catch (error) {
    console.error("[EXTENSION_TOKEN_ERROR]", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
