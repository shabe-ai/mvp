# LinkedIn Integration Setup Guide

## Step 1: Create LinkedIn Developer App

1. **Go to LinkedIn Developers:**
   - Visit: https://www.linkedin.com/developers/
   - Sign in with your LinkedIn account

2. **Create New App:**
   - Click "Create App"
   - Fill in the required information:
     - **App Name:** Shabe AI CRM
     - **LinkedIn Page:** Your company's LinkedIn page
     - **App Logo:** Upload your app logo
     - **Legal Agreement:** Accept terms

3. **Configure OAuth 2.0 Settings:**
   - Go to "Auth" tab
   - Add **Authorized Redirect URLs:**
     ```
     https://app.shabe.ai/api/auth/linkedin/callback
     http://localhost:3000/api/auth/linkedin/callback (for development)
     ```

4. **Request API Access:**
   - Go to "Products" tab
   - Request access to:
     - **Sign In with LinkedIn**
     - **Marketing Developer Platform**
     - **Share on LinkedIn**

## Step 2: Get API Credentials

1. **Client ID & Secret:**
   - Go to "Auth" tab
   - Copy your **Client ID** and **Client Secret**

2. **Add to Environment Variables:**
   ```env
   LINKEDIN_CLIENT_ID=your_client_id_here
   LINKEDIN_CLIENT_SECRET=your_client_secret_here
   ```

## Step 3: Configure App Permissions

### Required OAuth Scopes:
- `r_liteprofile` - Read basic profile
- `r_emailaddress` - Read email address
- `w_member_social` - Create and share posts
- `rw_organization_admin` - Manage company posts

### API Permissions:
- **Posts API** - Create and manage posts
- **Profile API** - Read profile information
- **Organization API** - Manage company pages

## Step 4: Submit for Review

1. **Complete App Verification:**
   - Fill out all required information
   - Provide app description and use cases
   - Submit for LinkedIn review

2. **Wait for Approval:**
   - LinkedIn typically reviews within 1-2 weeks
   - You can test with up to 25 users during development

## Step 5: Test Integration

1. **Development Testing:**
   - Use test LinkedIn accounts
   - Verify OAuth flow works
   - Test post creation and scheduling

2. **Production Deployment:**
   - Update redirect URLs for production
   - Monitor API usage and limits
   - Set up error monitoring

## API Rate Limits

- **Posts API:** 100 requests per day per user
- **Profile API:** 100 requests per day per user
- **Organization API:** 100 requests per day per organization

## Troubleshooting

### Common Issues:
1. **Invalid Redirect URI:** Ensure exact match in LinkedIn app settings
2. **Insufficient Permissions:** Request additional scopes if needed
3. **Rate Limiting:** Implement proper error handling and retry logic
4. **Token Expiration:** Handle token refresh automatically

### Error Codes:
- `invalid_request` - Check request parameters
- `unauthorized_client` - Verify client credentials
- `access_denied` - User denied permission
- `invalid_scope` - Requested scope not approved

## Security Best Practices

1. **Store tokens securely** in encrypted database
2. **Implement token refresh** before expiration
3. **Validate all user inputs** before posting
4. **Monitor API usage** for unusual activity
5. **Handle errors gracefully** with user-friendly messages
