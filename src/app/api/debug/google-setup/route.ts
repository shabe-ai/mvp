import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  
  return NextResponse.json({
    setupInstructions: {
      step1: "Go to Google Cloud Console (https://console.cloud.google.com/)",
      step2: "Select your project or create a new one",
      step3: "Go to 'APIs & Services' > 'Credentials'",
      step4: "Find your OAuth 2.0 Client ID or create a new one",
      step5: "In the OAuth client settings, verify these settings:",
      step6: {
        applicationType: "Web application",
        authorizedJavaScriptOrigins: [
          "http://localhost:3000",
          "https://your-production-domain.com" // Add your production domain
        ],
        authorizedRedirectURIs: [
          "http://localhost:3000/api/auth/google/callback",
          "https://your-production-domain.com/api/auth/google/callback" // Add your production domain
        ]
      }
    },
    currentConfiguration: {
      clientId: clientId ? "✅ Set" : "❌ Missing",
      clientSecret: clientSecret ? "✅ Set" : "❌ Missing",
      baseUrl,
      redirectUri,
      expectedRedirectUri: "http://localhost:3000/api/auth/google/callback"
    },
    troubleshooting: {
      invalidClientError: "This error usually means:",
      causes: [
        "1. Redirect URI in Google Cloud Console doesn't match exactly",
        "2. Client ID/Secret are incorrect",
        "3. OAuth consent screen is not properly configured",
        "4. Application type is not set to 'Web application'"
      ],
      solutions: [
        "1. Verify redirect URI is exactly: http://localhost:3000/api/auth/google/callback",
        "2. Check that client ID and secret match your .env.local file",
        "3. Ensure OAuth consent screen is configured",
        "4. Make sure application type is 'Web application'"
      ]
    }
  });
} 