import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyExtensionToken } from "@/lib/jwt";

/**
 * GET /api/history
 *
 * Returns the user's reply generation history.
 * Supports pagination via ?page=1&limit=20
 * Works with both NextAuth session and Bearer token.
 */
export async function GET(request: Request) {
  try {
    // ─── Authenticate ────────────────────────
    let userId: string | null = null;

    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = verifyExtensionToken(token);
      if (payload) {
        userId = payload.userId;
      }
    }

    if (!userId) {
      const session = await getServerSession(authOptions);
      if (session?.user?.email) {
        const sessionUser = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true },
        });
        userId = sessionUser?.id ?? null;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ─── Parse pagination params ─────────────
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    // ─── Fetch history ───────────────────────
    const [history, total] = await prisma.$transaction([
      prisma.replyHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          reviewText: true,
          reviewerName: true,
          starRating: true,
          generatedReply: true,
          createdAt: true,
        },
      }),
      prisma.replyHistory.count({ where: { userId } }),
    ]);

    return NextResponse.json({
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[HISTORY_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
