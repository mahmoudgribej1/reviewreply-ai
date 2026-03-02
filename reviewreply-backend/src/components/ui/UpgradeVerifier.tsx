"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * UpgradeVerifier
 *
 * Rendered on the dashboard when ?upgraded=true but user.plan is still FREE.
 * Polls /api/gumroad/verify-upgrade every 3 seconds (up to 10 attempts).
 * When the API confirms the upgrade, does a hard router.refresh() so the
 * server component re-fetches the updated plan.
 */
export default function UpgradeVerifier() {
  const router = useRouter();
  const attemptsRef = useRef(0);
  const maxAttempts = 10; // 30 seconds total

  useEffect(() => {
    const poll = async () => {
      if (attemptsRef.current >= maxAttempts) return;
      attemptsRef.current += 1;

      try {
        const res = await fetch("/api/gumroad/verify-upgrade", {
          method: "POST",
        });
        const data = await res.json();

        if (data.upgraded) {
          // Plan is now PRO — refresh the server component
          router.refresh();
          return;
        }
      } catch {
        // Silently ignore network errors and keep polling
      }
    };

    // First check immediately, then every 3 seconds
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [router]);

  return null; // No UI — works silently in the background
}
