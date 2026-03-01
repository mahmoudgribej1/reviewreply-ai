import Link from "next/link";
import {
  Sparkles,
  Chrome,
  MessageSquare,
  Zap,
  Shield,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Nav */}
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            <span className="font-bold text-violet-600">ReviewReply AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-4 py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Sparkles className="h-10 w-10 text-violet-600" />
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">
              ReviewReply AI
            </h1>
          </div>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            AI-powered review replies, injected directly into Google Maps.
            Reply to customer reviews without leaving the page.
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
            30 free AI-generated replies per month. No credit card required.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                <Chrome className="h-6 w-6 text-violet-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Install the extension
              </h3>
              <p className="text-sm text-gray-500">
                One-click install from the Chrome Web Store. Works on Google
                Maps review pages.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-violet-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Generate replies instantly
              </h3>
              <p className="text-sm text-gray-500">
                Click the &quot;Generate Reply&quot; button next to any review.
                Our AI crafts a personalized, professional reply.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-6 w-6 text-violet-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Post with one click
              </h3>
              <p className="text-sm text-gray-500">
                Edit the reply if you want, then hit send. The reply is pasted
                and submitted for you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 py-20 bg-gray-50" id="pricing">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">
            Simple pricing
          </h2>
          <p className="text-center text-gray-500 mb-12">
            Start free, upgrade when you need more.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free */}
            <Card>
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <CardDescription>Perfect for trying it out</CardDescription>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  $0<span className="text-base font-normal text-gray-400">/mo</span>
                </p>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    30 AI replies per month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Chrome Extension access
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Google Maps integration
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Reply history
                  </li>
                </ul>
                <Link href="/signup" className="block">
                  <Button variant="outline" className="w-full">
                    Get started
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="border-violet-300 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-violet-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Most popular
                </span>
              </div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Pro <Sparkles className="h-4 w-4 text-violet-600" />
                </CardTitle>
                <CardDescription>For busy business owners</CardDescription>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  $19<span className="text-base font-normal text-gray-400">/mo</span>
                </p>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-violet-500 flex-shrink-0" />
                    <strong>Unlimited</strong> AI replies
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-violet-500 flex-shrink-0" />
                    Chrome Extension access
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-violet-500 flex-shrink-0" />
                    Google Maps integration
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-violet-500 flex-shrink-0" />
                    Reply history
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-violet-500 flex-shrink-0" />
                    Priority AI model
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-violet-500 flex-shrink-0" />
                    Cancel anytime
                  </li>
                </ul>
                <Link href="/signup" className="block">
                  <Button className="w-full">Start free trial</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-8 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Sparkles className="h-4 w-4" />
            <span>© {new Date().getFullYear()} ReviewReply AI</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-400">
            <a href="#pricing" className="hover:text-gray-600">
              Pricing
            </a>
            <Link href="/login" className="hover:text-gray-600">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-gray-600">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
