"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";

const BUSINESS_TYPES = [
  "Restaurant",
  "Salon / Barbershop",
  "Gym / Fitness Studio",
  "Clinic / Medical Practice",
  "Hotel / Hospitality",
  "Retail Store",
  "Auto Service / Repair",
  "Real Estate",
  "Dental Practice",
  "Other",
];

const TONE_OPTIONS = [
  "Professional",
  "Friendly & Casual",
  "Warm & Personal",
  "Formal",
  "Witty & Fun",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("Professional");
  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          businessType,
          description,
          tone,
          ownerFirstName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save profile");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-violet-600" />
            <span className="text-xl font-bold text-violet-600">
              ReviewReply AI
            </span>
          </div>
          <CardTitle className="text-2xl">Set up your business</CardTitle>
          <CardDescription>
            Tell us about your business so we can generate replies in your voice.
            You can change this later in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Owner first name */}
            <div className="space-y-2">
              <Label htmlFor="ownerFirstName">Your first name</Label>
              <Input
                id="ownerFirstName"
                type="text"
                placeholder="Jane"
                value={ownerFirstName}
                onChange={(e) => setOwnerFirstName(e.target.value)}
                required
              />
              <p className="text-xs text-gray-400">
                Used to sign your replies (e.g. &quot;Thanks! — Jane&quot;)
              </p>
            </div>

            {/* Business name */}
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                type="text"
                placeholder="Sunny Side Café"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>

            {/* Business type */}
            <div className="space-y-2">
              <Label htmlFor="businessType">Business type</Label>
              <select
                id="businessType"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                <option value="">Select your business type</option>
                {BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Short description of your business
              </Label>
              <textarea
                id="description"
                placeholder="We're a cozy neighborhood café known for our homemade pastries and locally roasted coffee..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              />
              <p className="text-xs text-gray-400">
                This helps the AI write more authentic, specific replies
              </p>
            </div>

            {/* Tone */}
            <div className="space-y-2">
              <Label>Desired reply tone</Label>
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      tone === t
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-violet-400"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & continue to dashboard"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
