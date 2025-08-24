# LinkedIn Integration Setup

## Environment Variables

Add these to your `.env.local` file:

```env
# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your_linkedin_client_id_here
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret_here
```

## LinkedIn Developer App Setup

1. **Create LinkedIn Developer App:**
   - Go to https://www.linkedin.com/developers/
   - Click "Create App"
   - Fill in app details

2. **Configure OAuth Settings:**
   - Add redirect URLs:
     ```
     https://app.shabe.ai/api/auth/linkedin/callback
     http://localhost:3000/api/auth/linkedin/callback
     ```

3. **Request API Access:**
   - Sign In with LinkedIn
   - Marketing Developer Platform
   - Share on LinkedIn

4. **Get Credentials:**
   - Copy Client ID and Client Secret
   - Add to environment variables

## Testing the Integration

1. **Connect LinkedIn Account:**
   - Go to Admin → LinkedIn Integration
   - Click "Connect LinkedIn"
   - Authorize your account

2. **Create Posts via Chat:**
   - "Create a LinkedIn post about our new product"
   - "Schedule a LinkedIn post for tomorrow"
   - "Draft a LinkedIn post for our company announcement"

3. **Monitor Posts:**
   - View posts in Admin → LinkedIn Integration
   - Check post status and analytics

## Features

- ✅ LinkedIn OAuth integration
- ✅ AI-powered post generation
- ✅ Post scheduling
- ✅ Post preview and editing
- ✅ Automatic publishing via cron jobs
- ✅ Post analytics tracking
- ✅ Error handling and retry logic

## API Limits

- Posts API: 100 requests/day per user
- Profile API: 100 requests/day per user
- Organization API: 100 requests/day per organization

## Troubleshooting

- **Token Expired:** Reconnect LinkedIn account
- **Permission Denied:** Check OAuth scopes
- **Rate Limited:** Wait and retry
- **Post Failed:** Check content and try again
