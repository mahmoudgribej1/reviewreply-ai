import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-violet-50 to-white px-4">
      <div className="text-center max-w-2xl">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Sparkles className="h-10 w-10 text-violet-600" />
          <h1 className="text-4xl font-bold text-gray-900">ReviewReply AI</h1>
        </div>
        <p className="text-xl text-gray-600 mb-8">
          AI-powered review replies, injected directly into Google Business
          Profile. Reply to reviews without leaving the page.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg">Get started free</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Log in
            </Button>
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4">
          10 free AI-generated replies per month. No credit card required.
        </p>
      </div>
    </div>
  );
}
