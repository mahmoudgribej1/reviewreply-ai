import { NextResponse } from "next/server";

/**
 * GET /api/auth/google-client-id
 *
 * Returns the public Google OAuth Client ID so the Chrome extension
 * can build the OAuth URL without hardcoding credentials.
 */
export async function GET() {
  return NextResponse.json({
    clientId: process.env.GOOGLE_CLIENT_ID!,
  });
}
