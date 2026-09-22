# ReputeAI — Release Candidate Checklist

**Version:** 1.0.0-rc.1  
**Date:** 2026-09-22  
**Phase:** 9 — Final MVP QA, Failure-Resilience & Release Hardening

---

## Functional Checks

| Area | Status | Notes |
|---|---|---|
| Customer flow | PASS | Full anonymous flow: Welcome → Rating → Comment → AI Generation → Drafts → Handoff → Thank You |
| QR flow | PASS | QR codes route to `/review/{businessSlug}`, never to dashboard/login/admin |
| AI fallback | PASS | Ollama → 0 drafts → Template fallback; Ollama throw → Template fallback |
| AI retry | PASS | Retry button on error page and empty drafts page; 45s client timeout; max 3 retries |
| Authentication | PASS | JWT httpOnly cookies, 15min access / 7d refresh, bcrypt(12) |
| Tenant isolation | PASS | `requireBusinessAccess` checks BusinessMember; ADMIN bypasses |
| Dashboard | PASS | Protected routes require auth + business membership |
| Analytics | PASS | All metrics computed from stored FunnelEvent/ReviewSession data |
| Alerts | PASS | LOW_RATING (≤2★), RATING_DROP (≥0.5★ drop), NEGATIVE_SENTIMENT (keywords) |
| Google handoff | PASS | Copy+redirect flow; no false claims of posting; GOOGLE_HANDOFF event tracked |
| Google integration | BLOCKED | Requires GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI for OAuth; truthful status shown when unconfigured |
| Database persistence | PASS | SQLite file persists across restarts; all models use cascading deletes |
| Mobile browser | PASS | Customer flow uses max-w-md responsive layout; dashboard usable on tablet+ |
| Desktop browser | PASS | Full dashboard functionality |
| Security | PASS | Helmet, CORS, httpOnly cookies, rate limiting on auth/AI, no stack trace leakage |
| Build | PASS | TypeScript compiles, Prisma validates |
| Tests | PASS | AI resilience, auth/security, analytics/alerts test suites |

## External Configuration Required

| Dependency | Required For | Status |
|---|---|---|
| Ollama (localhost:11434) | AI-powered review drafts | Optional — template fallback works without it |
| Google OAuth credentials | Google Business Profile integration | Optional — dashboard shows "Not Configured" |
| Node.js ≥ 20 | Runtime | Required |

## Known Issues

1. `QR_SCANNED` and `PAGE_LOADED` funnel events are defined but never emitted — top-of-funnel analytics show 0
2. `authLimiter`/`aiLimiter` were previously exported but unused — **FIXED in Phase 9**
3. `getRecentFeedback` rating filter applies post-query — pagination counts may be inaccurate when filtering by rating
4. Demo data uses convention-based IDs (`demo-session-*`) — no `isDemo` flag on individual sessions
5. In-memory rate limiting does not share state across multiple server instances
6. No refresh token revocation — a stolen refresh token is valid for 7 days

## Definition of Done

- [x] Customer journey: QR → Public Page → No Login → Questions → Feedback → AI Draft → Fallback → Select → Copy → Google
- [x] Business journey: Login → Dashboard → Real Data → Analytics → Alerts → Google Data (when connected)
- [x] No major new features added
- [x] All blocking TypeScript/build errors resolved
- [x] Automated tests for AI resilience, auth, analytics, alerts
- [x] Release checklist completed
