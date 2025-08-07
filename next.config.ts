import {withSentryConfig} from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Re-enable checks for code quality
  eslint: {
    // Enable ESLint during builds
  },
  typescript: {
    // Enable TypeScript checks during builds
  },
  // Optimize build performance
  experimental: {
    optimizePackageImports: ['lucide-react'], // Removed FontAwesome
  },
  // Added a comment to trigger redeploy for new domain
  // New domain: app.shabe.ai
  // Trigger redeploy to pick up latest Clerk keys
};

export default withSentryConfig(nextConfig, {
// For all available options, see:
// https://www.npmjs.com/package/@sentry/webpack-plugin#options

org: "shabe-ai",
project: "shabe-prod-v1",

// Only print logs for uploading source maps in CI
silent: !process.env.CI,

// For all available options, see:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

// Disable source map uploads to speed up builds
widenClientFileUpload: false,

// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
// This can increase your server load as well as your hosting bill.
// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
// side errors will fail.
tunnelRoute: "/monitoring",

// Automatically tree-shake Sentry logger statements to reduce bundle size
disableLogger: true,

// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
// See the following for more information:
// https://docs.sentry.io/product/crons/
// https://vercel.com/docs/cron-jobs
automaticVercelMonitors: true,
});