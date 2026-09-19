# Google Business Profile Integration

## Prerequisites

To enable Google integration in ReputeAI, you need:

1. **Google Cloud Project** with the following APIs enabled:
   - Google Business Profile API (formerly Google My Business API)
   - Google Business Profile Performance API (optional, for analytics)

2. **OAuth 2.0 Consent Screen** configured in Google Cloud Console:
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3001/api/google/callback` (dev) or your production URL

3. **OAuth 2.0 Credentials**:
   - Client ID
   - Client Secret

4. **Business Verification**: The Google Business Profile must be verified and owned by the Google account that will authorize the connection.

> **Important**: The Google Business Profile API requires approval from Google. New projects may need to request access through the Google Cloud Console. See [Google's documentation](https://developers.google.com/my-business/content/prereqs) for current requirements.

## Environment Variables

Add these to your `server/.env` file:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback
```

> **Never commit credentials to the repository.** The `.env` file is in `.gitignore`.

## OAuth Flow

1. **Business owner** clicks "Connect Google Business Profile" in the dashboard
2. ReputeAI redirects to Google's OAuth consent screen
3. User authorizes access with the `business.manage` scope
4. Google redirects back to `/api/google/callback` with an authorization code
5. ReputeAI exchanges the code for access + refresh tokens
6. Tokens are stored encrypted in the `GoogleConnection` database record

## Token Lifecycle

| State | Description |
|-------|-------------|
| `CONNECTED` | Valid access token, Google API calls work |
| `EXPIRED` | Access token expired, refresh token available — auto-refresh attempted |
| `DISCONNECTED` | No tokens stored, user must re-authorize |
| `SYNCING` | Review sync is in progress |
| `SYNC_ERROR` | Last sync failed — error message stored |

- Access tokens expire after ~1 hour
- Refresh tokens are long-lived but can be revoked by the user
- ReputeAI automatically refreshes expired access tokens using the refresh token
- If refresh fails, status changes to `EXPIRED` and the user must reconnect

## Review Sync

When a business owner clicks "Sync Now":

1. ReputeAI fetches all Google accounts linked to the authorized user
2. For each account, fetches all locations
3. For each location, fetches all reviews (paginated)
4. Each review is upserted into the local `GoogleReview` table using the Google review ID as the unique key
5. The sync status and timestamp are updated

**Data Retrieved:**
- Reviewer display name
- Star rating (1-5)
- Review text (comment)
- Published date
- Existing owner reply (if any)

**Data NOT Available:**
- Reviewer email or profile
- Review photos
- Review helpfulness votes

## AI Reply Generation

1. Business owner selects a review and clicks "Generate AI Reply"
2. Chooses a tone: Professional, Friendly, Grateful, Apologetic, or Concise
3. ReputeAI generates a reply using the configured AI service (Ollama or template fallback)
4. The reply is shown in an editable text area
5. Business owner can edit the reply
6. **Replies are NEVER auto-published** — the owner must explicitly click "Post Reply"

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Google OAuth is not configured" | Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` in `.env` |
| "Token refresh failed" | User needs to disconnect and reconnect Google |
| "No Google Business accounts found" | The authorized Google account must own/manage a verified business |
| "Failed to fetch reviews" | Check that the Business Profile API is enabled in Google Cloud Console |
| Sync returns 0 reviews | The business may have no Google reviews, or the API access may need approval |

## Required OAuth Scope

```
https://www.googleapis.com/auth/business.manage
```

This scope provides read/write access to the business profile, including reviews and reply management.

## Testing Without Google Credentials

When Google credentials are not configured:
- The Google Connection page shows "Google OAuth is not configured on this server"
- The Google Reviews page shows a prompt to connect
- No fake/mock review data is displayed
- All other ReputeAI features (customer feedback, analytics, alerts, QR) work independently
