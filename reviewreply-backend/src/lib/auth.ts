import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  // PrismaAdapter handles creating Account/Session/User records for OAuth
  adapter: PrismaAdapter(prisma),

  providers: [
    // ─── Google OAuth ────────────────────────────
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Allow linking a Google account even when a credentials account
      // with the same email already exists. Without this, NextAuth
      // silently blocks the sign-in with an OAuthAccountNotLinked error.
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          // Always show the Google account picker, even if already signed in.
          // Without this, Google silently reuses the last authenticated session.
          prompt: "select_account",
        },
      },
    }),

    // ─── Email/Password (for extension + web login) ─
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],

  // Use JWT sessions (not database sessions) so credentials provider works
  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },

  callbacks: {
    // Always allow sign-in. Without this explicit callback the
    // PrismaAdapter can silently reject OAuth sign-ins when it
    // encounters existing accounts, returning the user to /login
    // with no error message (the "lottery" behaviour).
    async signIn() {
      return true;
    },

    // Include user ID and plan in the JWT token.
    // When `account` is present it's a fresh sign-in — always
    // refresh the token.id from the DB-resolved `user` object.
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      // On OAuth sign-in the adapter resolves the real DB user,
      // so always pick up the latest id even if it changed.
      if (account && user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },

    // Include user ID in the session object so pages can access it
    async session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as Record<string, unknown>).id = token.id as string;
      }
      return session;
    },
  },
};
