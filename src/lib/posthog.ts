import posthog from 'posthog-js'

let isInitialized = false;

if (typeof window !== 'undefined') {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  
  // Only initialize if we have a valid API key
  if (posthogKey && posthogKey !== 'phc_placeholder' && posthogKey.length > 10) {
    try {
      posthog.init(posthogKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
        loaded: (posthog) => {
          if (process.env.NODE_ENV === 'development') posthog.debug()
        },
        capture_pageview: false, // We'll handle this manually
        capture_pageleave: true,
        autocapture: true,
        disable_session_recording: false,
        session_recording: {
          maskAllInputs: true,
          maskInputOptions: {
            password: true,
            email: true,
            phone: true,
          },
        },
      });
      isInitialized = true;
      console.log('✅ PostHog initialized successfully');
    } catch (error) {
      console.warn('⚠️ PostHog initialization failed:', error);
    }
  } else {
    console.log('ℹ️ PostHog not initialized - no valid API key provided');
  }
}

// Create a safe wrapper for PostHog methods
export const safePostHog = {
  capture: (event: string, properties?: any) => {
    if (isInitialized && typeof window !== 'undefined') {
      try {
        posthog.capture(event, properties);
      } catch (error) {
        console.warn('⚠️ PostHog capture failed:', error);
      }
    }
  },
  identify: (userId: string, properties?: any) => {
    if (isInitialized && typeof window !== 'undefined') {
      try {
        posthog.identify(userId, properties);
      } catch (error) {
        console.warn('⚠️ PostHog identify failed:', error);
      }
    }
  },
  set: (properties: any) => {
    if (isInitialized && typeof window !== 'undefined') {
      try {
        posthog.set(properties);
      } catch (error) {
        console.warn('⚠️ PostHog set failed:', error);
      }
    }
  },
  isInitialized: () => isInitialized
};

export { posthog } 