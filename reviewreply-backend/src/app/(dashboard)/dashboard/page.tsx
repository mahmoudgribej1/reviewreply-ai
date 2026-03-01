import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sparkles, CheckCircle, Star, Clock, MessageSquare } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import UpgradeButton from "@/components/ui/UpgradeButton";
import { SignOutButton, ManageBillingButton } from "@/components/ui/DashboardActions";
import { FREE_GENERATION_LIMIT } from "@/lib/constants";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { upgraded?: string };
}) {
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

  if (!user.businessProfile) {
    redirect("/onboarding");
  }

  // Fetch recent reply history
  const recentReplies = await prisma.replyHistory.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      reviewText: true,
      reviewerName: true,
      starRating: true,
      generatedReply: true,
      createdAt: true,
    },
  });

  const totalReplies = await prisma.replyHistory.count({
    where: { userId: user.id },
  });

  const usagePercent =
    user.plan === "PRO"
      ? 0
      : Math.round(
          (user.generationsUsedThisMonth / FREE_GENERATION_LIMIT) * 100
        );

  // Calculate reset date
  const resetDate = new Date(user.generationsPeriodStart);
  resetDate.setDate(resetDate.getDate() + 30);
  const daysUntilReset = Math.max(
    0,
    Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            <span className="font-bold text-violet-600">ReviewReply AI</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-gray-500">
              {user.businessProfile.businessName}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                user.plan === "PRO"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {user.plan}
            </span>
            {user.plan === "PRO" && <ManageBillingButton />}
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Welcome back, {user.businessProfile.ownerFirstName}!
        </h1>

        {/* Success banner after payment */}
        {searchParams.upgraded === "true" && user.plan === "PRO" && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">
              You&apos;re now on the Pro plan! Enjoy unlimited AI reply generations.
            </p>
          </div>
        )}

        {/* Processing banner */}
        {searchParams.upgraded === "true" && user.plan !== "PRO" && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            <Sparkles className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">
              Payment received! Your Pro upgrade is being processed — refresh this page in a few seconds.
            </p>
          </div>
        )}

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
              {user.plan === "PRO" ? (
                <div className="flex items-center gap-2 text-sm text-violet-600">
                  <Sparkles className="h-4 w-4" />
                  <span>{totalReplies} total replies generated</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-violet-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    Resets in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}
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
                Reply to reviews with AI in 4 simple steps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>Install the ReviewReply Chrome Extension</li>
                <li>
                  Open your business on{" "}
                  <a
                    href="https://www.google.com/maps"
                    target="_blank"
                    className="text-violet-600 hover:underline"
                  >
                    Google Maps
                  </a>
                </li>
                <li>Click &quot;✨ Generate Reply&quot; next to any review</li>
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

          {/* Upgrade Card — FREE users only */}
          {user.plan !== "PRO" && (
            <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-600" />
                  Upgrade to Pro
                </CardTitle>
                <CardDescription>
                  Unlock unlimited AI reply generations for your business
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  <li>✅ Unlimited reply generations</li>
                  <li>✅ Priority AI model</li>
                  <li>✅ Cancel anytime</li>
                </ul>
                <UpgradeButton />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Reply History */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-violet-600" />
              Recent replies
            </h2>
            {totalReplies > 0 && (
              <span className="text-sm text-gray-400">
                {totalReplies} total
              </span>
            )}
          </div>

          {recentReplies.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-400">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No replies generated yet.</p>
                <p className="text-xs mt-1">
                  Use the Chrome Extension on Google Maps to generate your first reply!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentReplies.map((reply) => (
                <Card key={reply.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {reply.reviewerName || "Anonymous"}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < reply.starRating
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-gray-200"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-1 mb-1">
                          &ldquo;{reply.reviewText}&rdquo;
                        </p>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {reply.generatedReply}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
                        <Clock className="h-3 w-3" />
                        {new Date(reply.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
