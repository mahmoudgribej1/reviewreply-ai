import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signExtensionToken } from "@/lib/jwt";
import { FREE_GENERATION_LIMIT } from "@/lib/constants";

/**
 * POST /api/auth/extension-google-login
 *
 * Accepts a Google authorization code from the Chrome extension
 * (obtained via chrome.identity.launchWebAuthFlow), exchanges it
 * for tokens, fetches the user profile, finds or creates the user,
 * and returns a JWT for the extension.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, redirectUri } = body;

    if (!code || !redirectUri) {
      return NextResponse.json(
        { error: "Authorization code and redirectUri are required" },
        { status: 400 }
      );
    }

    // ─── Exchange code for tokens with Google ─
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[EXT_GOOGLE_LOGIN] Token exchange failed:", tokenData);
      return NextResponse.json(
        { error: "Failed to authenticate with Google" },
        { status: 401 }
      );
    }

    // ─── Get user profile from Google ────────
    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );

    const profile = await profileRes.json();

    if (!profileRes.ok || !profile.email) {
      console.error("[EXT_GOOGLE_LOGIN] Profile fetch failed:", profile);
      return NextResponse.json(
        { error: "Failed to get Google profile" },
        { status: 401 }
      );
    }

    // ─── Find or create user ─────────────────
    // Lowercase email for consistent matching (Google returns lowercase
    // but NextAuth PrismaAdapter might have stored it differently)
    const email = profile.email.toLowerCase();

    let user = await prisma.user.findUnique({
      where: { email },
      include: { businessProfile: true },
    });

    if (!user) {
      // Create new user from Google profile
      user = await prisma.user.create({
        data: {
          email,
          name: profile.name || email.split("@")[0],
          image: profile.picture || null,
          emailVerified: new Date(),
        },
        include: { businessProfile: true },
      });
    }

    // Also link the Google account in the Account table if not already linked
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: user.id,
        provider: "google",
      },
    });

    if (!existingAccount) {
      await prisma.account.create({
        data: {
          userId: user.id,
          type: "oauth",
          provider: "google",
          providerAccountId: profile.id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          expires_at: tokenData.expires_in
            ? Math.floor(Date.now() / 1000) + tokenData.expires_in
            : null,
          token_type: tokenData.token_type || "Bearer",
          scope: tokenData.scope || null,
          id_token: tokenData.id_token || null,
        },
      });
    }

    // ─── Sign JWT for extension ──────────────
    const token = signExtensionToken({
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({
      token,
      user: {
        name: user.name,
        plan: user.plan,
        generationsUsed: user.generationsUsedThisMonth,
        generationsLimit:
          user.plan === "PRO" ? "unlimited" : FREE_GENERATION_LIMIT,
        hasBusinessProfile: !!user.businessProfile,
      },
    });
  } catch (error) {
    console.error("[EXT_GOOGLE_LOGIN_ERROR]", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
