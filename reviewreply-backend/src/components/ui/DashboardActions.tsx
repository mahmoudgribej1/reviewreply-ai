"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, CreditCard, Loader2 } from "lucide-react";

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-gray-500 hover:text-gray-700"
    >
      <LogOut className="h-4 w-4 mr-1.5" />
      Sign out
    </Button>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/gumroad/portal", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.portalUrl) {
        window.open(data.portalUrl, "_blank");
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
      ) : (
        <CreditCard className="h-4 w-4 mr-1.5" />
      )}
      Manage billing
    </Button>
  );
}
