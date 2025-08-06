import posthog from 'posthog-js';

let isInitialized = false;

// Initialize PostHog
export function initializePostHog() {
  if (typeof window === 'undefined') return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  
  if (!posthogKey) {
    console.warn('⚠️ PostHog key not found, analytics disabled');
    return;
  }

  try {
    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      loaded: (_posthogInstance) => { // eslint-disable-line @typescript-eslint/no-unused-vars
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ PostHog initialized');
        }
      },
      capture_pageview: false, // We'll handle this manually
      capture_pageleave: false, // We'll handle this manually
      autocapture: false, // We'll handle this manually
      disable_session_recording: true, // Disable session recording for privacy
      opt_out_capturing_by_default: false,
      persistence: 'localStorage',
      cross_subdomain_cookie: false,
      secure_cookie: true,
    });
    
    isInitialized = true;
  } catch (error) {
    console.error('❌ Failed to initialize PostHog:', error);
  }
}

// Create a safe wrapper for PostHog methods
export const safePostHog = {
  capture: (event: string, properties?: Record<string, unknown>) => {
    if (isInitialized && typeof window !== 'undefined') {
      try {
        posthog.capture(event, properties);
      } catch (error) {
        console.warn('⚠️ PostHog capture failed:', error);
      }
    }
  },
  identify: (userId: string, properties?: Record<string, unknown>) => {
    if (isInitialized && typeof window !== 'undefined') {
      try {
        posthog.identify(userId, properties);
      } catch (error) {
        console.warn('⚠️ PostHog identify failed:', error);
      }
    }
  },
  set: (properties: Record<string, unknown>) => {
    if (isInitialized && typeof window !== 'undefined') {
      try {
        posthog.people.set(properties);
      } catch (error) {
        console.warn('⚠️ PostHog set failed:', error);
      }
    }
  },
  isInitialized: () => isInitialized
}; 