"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { safePostHog } from "@/lib/posthog";

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      // Identify user
      safePostHog.identify(user.id, {
        email: user.emailAddresses[0]?.emailAddress,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        firstName: user.firstName,
        lastName: user.lastName,
      });

      // Track page view
      safePostHog.capture('$pageview');
    }
  }, [user, isLoaded]);

  return <>{children}</>;
} 