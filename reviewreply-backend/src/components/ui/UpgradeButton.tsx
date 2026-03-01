"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function UpgradeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/lemonsqueezy/checkout", {
        method: "POST",
        credentials: "include", // ensure session cookies are sent
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || `Error ${res.status}`;
        setError(msg);
        console.error("[UpgradeButton] API error:", msg, data);
        return;
      }

      if (!data.checkoutUrl) {
        setError("No checkout URL returned — check server logs");
        return;
      }

      // Navigate to LemonSqueezy hosted checkout
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error("[UpgradeButton] Network error:", err);
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleUpgrade}
        disabled={loading}
        className="w-full bg-violet-600 hover:bg-violet-700 text-white"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        {loading ? "Redirecting…" : "Upgrade to Pro — $9.99/mo"}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
