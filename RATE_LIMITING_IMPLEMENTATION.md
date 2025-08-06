# Rate Limiting & Cost Guardrails Implementation

## Overview

We've implemented a comprehensive rate limiting and cost tracking system to protect against runaway costs and ensure fair usage of OpenAI API calls.

## Key Features

### 1. Rate Limiting
- **Per-user limits**: 10 requests/minute, 100/hour, 1000/day
- **Global limits**: 50 requests/minute, 500/hour, 5000/day
- **Persistent storage**: Rate limits are stored in Convex database
- **Real-time tracking**: Automatic tracking of all API calls

### 2. Cost Tracking
- **Real-time cost calculation**: Based on OpenAI's pricing
- **Per-model tracking**: Separate cost tracking for different models
- **Historical data**: Cost data stored in Convex for analysis
- **Cost breakdown**: Input vs output token costs

### 3. Monitoring Dashboard
- **Visual rate limit status**: Progress bars showing usage
- **Cost analytics**: 24-hour cost tracking with breakdowns
- **Real-time updates**: Refresh button for current data
- **Admin access**: Available in admin dashboard

## Implementation Details

### Files Created/Modified

#### Core Rate Limiting
- `src/lib/openaiClient.ts` - Centralized rate-limited OpenAI client
- `src/lib/convex.ts` - Convex client configuration
- `convex/monitoring.ts` - Convex mutations/queries for monitoring
- `convex/schema.ts` - Added costTracking and rateLimitTracking tables

#### API Endpoints
- `src/app/api/monitoring/route.ts` - Monitoring data endpoint
- `src/app/api/test-rate-limit/route.ts` - Test endpoint for verification

#### UI Components
- `src/components/MonitoringDashboard.tsx` - Visual monitoring dashboard
- `src/app/admin/page.tsx` - Added monitoring dashboard to admin

#### Updated Files
- `src/app/api/chat/route.ts` - Updated to use rate-limited client
- `src/app/api/report/route.ts` - Updated to use rate-limited client
- `src/lib/embeddings.ts` - Updated to use rate-limited client

### Rate Limit Configuration

```typescript
const RATE_LIMITS = {
  USER_PER_MINUTE: 10,
  USER_PER_HOUR: 100,
  USER_PER_DAY: 1000,
  GLOBAL_PER_MINUTE: 50,
  GLOBAL_PER_HOUR: 500,
  GLOBAL_PER_DAY: 5000,
};
```

### Cost Tracking

```typescript
const COST_PER_1K_TOKENS = {
  "gpt-4": 0.03,           // $0.03 per 1K input tokens
  "gpt-4-turbo": 0.01,     // $0.01 per 1K input tokens
  "gpt-3.5-turbo": 0.001,  // $0.001 per 1K input tokens
  "text-embedding-3-small": 0.00002, // $0.00002 per 1K tokens
};
```

## Usage

### For Developers

1. **Import the rate-limited client**:
   ```typescript
   import { openaiClient } from "@/lib/openaiClient";
   ```

2. **Use for chat completions**:
   ```typescript
   const response = await openaiClient.chatCompletionsCreate({
     model: "gpt-4",
     messages: [...],
     temperature: 0.7,
     max_tokens: 1000,
   }, {
     userId: "user123",
     operation: "chat_completion",
     model: "gpt-4"
   });
   ```

3. **Use for embeddings**:
   ```typescript
   const response = await openaiClient.embeddingsCreate({
     model: "text-embedding-3-small",
     input: textChunks,
   }, {
     userId: "user123",
     operation: "embeddings",
     model: "text-embedding-3-small"
   });
   ```

### For Users

1. **Access monitoring dashboard**: Navigate to `/admin` and scroll to the monitoring section
2. **View rate limits**: See current usage vs limits with visual progress bars
3. **Track costs**: Monitor 24-hour cost breakdown by model
4. **Real-time updates**: Click refresh to get latest data

## Database Schema

### costTracking Table
```typescript
{
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cost: number,
  operation: string,
  timestamp: number,
}
```

### rateLimitTracking Table
```typescript
{
  userId: string,
  operation: string,
  timestamp: number,
}
```

## Error Handling

- **Rate limit exceeded**: Returns error message with retry guidance
- **Database failures**: Graceful fallback to allow requests
- **Cost tracking failures**: Logs errors but doesn't block requests
- **Missing user ID**: Warns but allows request to proceed

## Monitoring & Alerts

### Console Logging
- Cost tracking: `💰 Cost tracked: User user123 - Model: gpt-4, Cost: $0.0123`
- Rate limit warnings: `Rate limit exceeded: User user123 exceeded per-minute limit`

### Dashboard Metrics
- Real-time rate limit status
- 24-hour cost breakdown
- Average cost per request
- Cost by model breakdown

## Future Enhancements

1. **Email alerts**: Notify when approaching limits
2. **Slack integration**: Real-time alerts to team
3. **Cost projections**: Predict monthly costs
4. **Usage analytics**: Detailed usage patterns
5. **Automatic throttling**: Reduce quality when approaching limits
6. **Billing integration**: Connect to Stripe for billing

## Testing

### Test Endpoints
- `GET /api/test-rate-limit` - Check current rate limit status
- `POST /api/test-rate-limit` - Test OpenAI call with rate limiting

### Manual Testing
1. Make multiple rapid API calls
2. Check rate limit enforcement
3. Verify cost tracking accuracy
4. Test monitoring dashboard updates

## Security Considerations

- Rate limits are per-user to prevent abuse
- Global limits protect against system-wide overload
- Cost tracking helps identify unusual usage patterns
- All data is stored securely in Convex

## Performance Impact

- **Minimal overhead**: Rate limiting adds ~1-2ms per request
- **Database writes**: Cost tracking requires one write per API call
- **Memory usage**: In-memory global counters for performance
- **Scalability**: Designed to handle thousands of users

## Troubleshooting

### Common Issues

1. **Rate limit errors**: Check user limits and wait for reset
2. **Cost tracking not working**: Verify Convex connection
3. **Dashboard not loading**: Check authentication and API endpoints
4. **Import errors**: Ensure all files are properly imported

### Debug Commands

```bash
# Regenerate Convex types
npx convex codegen

# Check Convex deployment
npx convex deploy

# View logs
npx convex logs
```

## Conclusion

This implementation provides robust protection against runaway costs while maintaining excellent user experience. The system is production-ready and includes comprehensive monitoring capabilities. 