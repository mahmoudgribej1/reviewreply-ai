import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FREE_GENERATION_LIMIT = 10;

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businessProfile: true },
  });

  if (!user) {
    redirect("/login");
  }

  // Redirect to onboarding if no business profile yet
  if (!user.businessProfile) {
    redirect("/onboarding");
  }

  const usagePercent =
    user.plan === "PRO"
      ? 0
      : Math.round(
          (user.generationsUsedThisMonth / FREE_GENERATION_LIMIT) * 100
        );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            <span className="font-bold text-violet-600">ReviewReply AI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {user.businessProfile.businessName}
            </span>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                user.plan === "PRO"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {user.plan}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Welcome back, {user.businessProfile.ownerFirstName}!
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Usage Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage this month</CardTitle>
              <CardDescription>
                {user.plan === "PRO"
                  ? "Unlimited generations on the Pro plan"
                  : `${user.generationsUsedThisMonth} of ${FREE_GENERATION_LIMIT} free generations used`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user.plan !== "PRO" && (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-violet-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    Resets every 30 days
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Start Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Get started</CardTitle>
              <CardDescription>
                Install the Chrome Extension to reply to reviews with AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>Install the ReviewReply Chrome Extension</li>
                <li>
                  Open your{" "}
                  <a
                    href="https://business.google.com/reviews"
                    target="_blank"
                    className="text-violet-600 hover:underline"
                  >
                    Google Business Profile reviews
                  </a>
                </li>
                <li>
                  Click &quot;✨ Generate Reply&quot; next to any review
                </li>
                <li>Edit if needed, then hit Send!</li>
              </ol>
            </CardContent>
          </Card>

          {/* Business Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your business</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-1">
              <p>
                <span className="font-medium">Name:</span>{" "}
                {user.businessProfile.businessName}
              </p>
              <p>
                <span className="font-medium">Type:</span>{" "}
                {user.businessProfile.businessType}
              </p>
              <p>
                <span className="font-medium">Tone:</span>{" "}
                {user.businessProfile.tone}
              </p>
              <p>
                <span className="font-medium">Owner:</span>{" "}
                {user.businessProfile.ownerFirstName}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
