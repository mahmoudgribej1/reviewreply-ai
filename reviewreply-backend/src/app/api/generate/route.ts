import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyExtensionToken } from "@/lib/jwt";
import { generateReply } from "@/lib/groq";

const FREE_GENERATION_LIMIT = 10;

/**
 * POST /api/generate
 *
 * Accepts a Google review and returns an AI-generated reply.
 * Works with both NextAuth session (web) and Bearer token (extension).
 *
 * Body: { reviewText, reviewerName?, starRating }
 */
export async function POST(request: Request) {
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

    // ─── Parse & validate body ───────────────
    const body = await request.json();
    const { reviewText, reviewerName, starRating } = body;

    if (!reviewText || typeof reviewText !== "string") {
      return NextResponse.json(
        { error: "reviewText is required" },
        { status: 400 }
      );
    }

    if (starRating === undefined || starRating < 1 || starRating > 5) {
      return NextResponse.json(
        { error: "starRating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // ─── Fetch user + profile ────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { businessProfile: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.businessProfile) {
      return NextResponse.json(
        { error: "Please complete your business profile first" },
        { status: 400 }
      );
    }

    // ─── Check usage limits ──────────────────
    // Reset counter if we're in a new billing period (30 days)
    const now = new Date();
    const periodStart = new Date(user.generationsPeriodStart);
    const daysSincePeriodStart =
      (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);

    let generationsUsed = user.generationsUsedThisMonth;

    if (daysSincePeriodStart >= 30) {
      // Reset the counter — new period
      await prisma.user.update({
        where: { id: userId },
        data: {
          generationsUsedThisMonth: 0,
          generationsPeriodStart: now,
        },
      });
      generationsUsed = 0;
    }

    // Enforce limits for FREE plan
    if (user.plan === "FREE" && generationsUsed >= FREE_GENERATION_LIMIT) {
      return NextResponse.json(
        {
          error: "Monthly generation limit reached",
          limit: FREE_GENERATION_LIMIT,
          used: generationsUsed,
          upgradeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=true`,
        },
        { status: 429 }
      );
    }

    // ─── Generate AI reply ───────────────────
    const profile = user.businessProfile;
    const reply = await generateReply({
      reviewText,
      reviewerName: reviewerName || "the customer",
      starRating,
      businessName: profile.businessName,
      businessType: profile.businessType,
      businessDescription: profile.description,
      ownerFirstName: profile.ownerFirstName,
      tone: profile.tone,
    });

    // ─── Save to history & increment usage ───
    const [history] = await prisma.$transaction([
      prisma.replyHistory.create({
        data: {
          userId,
          reviewText,
          reviewerName,
          starRating,
          generatedReply: reply,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          generationsUsedThisMonth: { increment: 1 },
        },
      }),
    ]);

    return NextResponse.json({
      reply,
      historyId: history.id,
      usage: {
        used: generationsUsed + 1,
        limit: user.plan === "PRO" ? "unlimited" : FREE_GENERATION_LIMIT,
        plan: user.plan,
      },
    });
  } catch (error) {
    console.error("[GENERATE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate reply" },
      { status: 500 }
    );
  }
}
