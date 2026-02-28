import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signExtensionToken } from "@/lib/jwt";

// Free plan limit
const FREE_GENERATION_LIMIT = 10;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // ─── Validation ──────────────────────────
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // ─── Find user ───────────────────────────
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { businessProfile: true },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // ─── Check password ──────────────────────
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // ─── Sign JWT ────────────────────────────
    const token = signExtensionToken({
      userId: user.id,
      email: user.email,
    });

    // ─── Return token + user data ────────────
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
    console.error("[EXTENSION_LOGIN_ERROR]", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
