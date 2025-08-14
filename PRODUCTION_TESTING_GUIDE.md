# Production Testing Guide

## 🚀 System Status: PRODUCTION READY

Your Shabe AI system is now deployed and ready for comprehensive testing on production.

## 📋 Pre-Testing Checklist

### ✅ Environment Variables (Verify these are set in production)
- `OPENAI_API_KEY` - Required for all AI operations
- `NEXT_PUBLIC_CONVEX_URL` - Database connection
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Authentication
- `CLERK_SECRET_KEY` - Authentication
- `GOOGLE_CLIENT_ID` - Email integration
- `GOOGLE_CLIENT_SECRET` - Email integration
- `SENTRY_DSN` - Error monitoring
- `POSTHOG_KEY` - Analytics

### ✅ External Services
- **Clerk Authentication**: Working
- **Convex Database**: Connected
- **OpenAI API**: Configured
- **Google OAuth**: Set up for email
- **Sentry**: Error tracking active
- **PostHog**: Analytics tracking

## 🧪 Core Feature Testing

### 1. **Authentication & Onboarding**
```
Test Steps:
1. Visit your production URL
2. Sign up with a new account
3. Verify email verification works
4. Test sign-in flow
5. Check if user data is created in Convex

Expected: Smooth onboarding, user created in database
```

### 2. **Conversational AI (Core Feature)**
```
Test Messages:
- "Hello, how are you?"
- "What can you help me with?"
- "Show me my contacts"
- "How many deals do I have?"
- "Create a chart of my sales pipeline"

Expected: Natural responses, proper intent classification
```

### 3. **Data Queries & Analysis**
```
Test Queries:
- "How many contacts do I have?"
- "Show me all my deals"
- "What's my biggest deal?"
- "List my accounts by industry"
- "Find contacts from Google"

Expected: Accurate data retrieval, proper formatting
```

### 4. **Chart Generation**
```
Test Requests:
- "Create a bar chart of my deals by stage"
- "Show me a pie chart of contacts by source"
- "Generate a line chart of sales over time"
- "Create a chart from my uploaded data"

Expected: Interactive charts with AI insights
```

### 5. **Email Integration**
```
Test Scenarios:
1. "Send an email to john@example.com"
2. "Draft a follow-up email to my biggest deal"
3. "Send a thank you email to a new contact"

Expected: Email drafting, Gmail integration, confirmation flow
```

### 6. **Contact Management**
```
Test Operations:
- "Create a contact for Jane Doe at jane@company.com"
- "Update John Smith's phone number to 555-1234"
- "Delete the contact for Bob Wilson"
- "Find contacts from Microsoft"

Expected: CRUD operations with confirmation
```

### 7. **File Analysis**
```
Test Uploads:
1. Upload a CSV file with sales data
2. Ask: "What's the total revenue in this file?"
3. Ask: "Create a chart from this data"
4. Upload a PDF and ask questions

Expected: File processing, RAG enhancement, insights
```

## 🔍 Performance Testing

### Response Time Benchmarks
```
Target Response Times:
- Simple queries: < 2 seconds
- Chart generation: < 5 seconds
- File analysis: < 10 seconds
- Email drafting: < 3 seconds

Monitor in Sentry Performance tab
```

### Load Testing
```
Test Scenarios:
1. Send 10 rapid messages
2. Upload multiple files simultaneously
3. Generate multiple charts in sequence
4. Test rate limiting behavior

Expected: Graceful handling, no timeouts
```

## 🐛 Error Handling Testing

### Intentional Error Scenarios
```
Test Cases:
1. Send malformed requests
2. Try to access non-existent data
3. Upload unsupported file types
4. Test with invalid email addresses
5. Disconnect internet during requests

Expected: Graceful error messages, no crashes
```

### Edge Cases
```
Test Scenarios:
1. Very long messages (>1000 characters)
2. Special characters and emojis
3. Empty messages
4. Rapid clicking/typing
5. Browser back/forward navigation

Expected: System remains stable
```

## 📊 Monitoring & Analytics

### Sentry Monitoring
```
Check These Dashboards:
1. Error rate (should be < 1%)
2. Performance metrics
3. User sessions
4. API response times
5. Memory usage

URL: https://sentry.io/organizations/shabe-ai/
```

### PostHog Analytics
```
Monitor These Events:
1. User sign-ups
2. Chat messages sent
3. Charts generated
4. Emails sent
5. File uploads
6. Feature usage patterns

URL: https://app.posthog.com/
```

### Convex Analytics
```
Check Database:
1. User creation rate
2. Data query performance
3. Storage usage
4. API call frequency
5. Cost tracking

URL: https://dashboard.convex.dev/
```

## 🚨 Critical Issues to Watch For

### Immediate Red Flags
```
❌ Authentication failures
❌ Database connection errors
❌ OpenAI API timeouts
❌ Email sending failures
❌ Chart generation crashes
❌ File upload failures
❌ High error rates (>5%)
❌ Response times >10 seconds
```

### Performance Issues
```
⚠️ Slow page loads (>3 seconds)
⚠️ High memory usage
⚠️ Frequent timeouts
⚠️ Rate limit errors
⚠️ Cache misses
```

## 🔧 Quick Debugging Commands

### Check Production Logs
```bash
# Vercel logs
vercel logs --follow

# Check specific function
vercel logs --function api/chat
```

### Test API Endpoints
```bash
# Test chat endpoint
curl -X POST https://your-domain.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# Test health check
curl https://your-domain.vercel.app/api/monitoring
```

### Database Queries
```bash
# Check user data
npx convex run api:crm.getTeamsByUser --userId="test_user_id"

# Check system health
npx convex run api:monitoring.getSystemHealth
```

## 📈 Success Metrics

### User Experience
```
✅ Response time < 3 seconds
✅ Error rate < 1%
✅ Successful feature completion > 95%
✅ User satisfaction (if you collect feedback)
```

### Technical Performance
```
✅ API uptime > 99.9%
✅ Database response time < 500ms
✅ OpenAI API success rate > 98%
✅ Memory usage stable
```

### Business Metrics
```
✅ User registration working
✅ Core features functional
✅ Data persistence working
✅ Email integration working
```

## 🎯 Testing Priority Order

### Phase 1: Critical Path (Test First)
1. Authentication & user creation
2. Basic chat functionality
3. Data queries
4. Chart generation

### Phase 2: Core Features
1. Email integration
2. Contact management
3. File uploads
4. Error handling

### Phase 3: Advanced Features
1. Performance under load
2. Edge cases
3. Analytics tracking
4. Monitoring alerts

## 🆘 Emergency Contacts

### If Something Breaks
1. **Check Sentry** for error details
2. **Check Vercel logs** for deployment issues
3. **Check Convex dashboard** for database issues
4. **Check OpenAI status** for API issues

### Rollback Plan
```bash
# If needed, rollback to previous deployment
vercel rollback

# Or revert to specific commit
git revert HEAD
git push
```

## 🎉 Ready to Test!

Your system is production-ready with:
- ✅ Clean architecture
- ✅ Comprehensive error handling
- ✅ Performance monitoring
- ✅ Security measures
- ✅ All core features implemented

**Start testing and let me know if you encounter any issues!**
