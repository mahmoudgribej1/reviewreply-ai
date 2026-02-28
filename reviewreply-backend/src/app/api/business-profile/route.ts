import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessName, businessType, description, tone, ownerFirstName } =
      body;

    // ─── Validation ──────────────────────────
    if (!businessName || !businessType || !description || !ownerFirstName) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // ─── Find user ───────────────────────────
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ─── Upsert business profile ─────────────
    const profile = await prisma.businessProfile.upsert({
      where: { userId: user.id },
      update: {
        businessName,
        businessType,
        description,
        tone: tone || "Professional",
        ownerFirstName,
      },
      create: {
        userId: user.id,
        businessName,
        businessType,
        description,
        tone: tone || "Professional",
        ownerFirstName,
      },
    });

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("[BUSINESS_PROFILE_ERROR]", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businessProfile: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ profile: user.businessProfile });
  } catch (error) {
    console.error("[BUSINESS_PROFILE_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
