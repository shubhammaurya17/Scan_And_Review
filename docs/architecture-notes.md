# ReputeAI — Architecture & Validation Notes

## Funnel Analytics Verification

All funnel metrics are **deterministic database calculations** — no AI involvement, no estimation.

The `FunnelEvent` model stores typed events with `businessId` and `eventType`:

| Event | When Tracked |
|-------|-------------|
| `QR_SCANNED` | Customer loads `/review/:slug` |
| `SESSION_STARTED` | `startSession()` creates a new `ReviewSession` |
| `RATING_SUBMITTED` | `submitFeedback()` saves ratings |
| `COMMENT_SUBMITTED` | `submitFeedback()` when comment is provided |
| `DRAFTS_GENERATED` | `generateDrafts()` completes |
| `DRAFT_SELECTED` | `selectDraft()` is called |
| `DRAFT_EDITED` | Customer modifies the draft text |
| `GOOGLE_HANDOFF` | `recordHandoff()` — customer clicks "Continue to Google" |

Metrics are computed via `prisma.funnelEvent.groupBy({ by: ['eventType'], _count: true })` — a SQL `COUNT(*) GROUP BY` query. No interpolation or estimation.

Conversion rates are calculated as:
```
Completion Rate = RATING_SUBMITTED / SESSION_STARTED
Draft Selection Rate = DRAFT_SELECTED / DRAFTS_GENERATED
Google Handoff Rate = GOOGLE_HANDOFF / DRAFT_SELECTED
Overall Conversion = GOOGLE_HANDOFF / SESSION_STARTED
```

## AI Hallucination Prevention

### Ollama Service
The prompts in `ollama.service.ts` include explicit grounding constraints:
- "Based ONLY on the following customer feedback"
- "Do NOT invent any details not provided"
- "Do NOT mention aspects the customer did not rate or comment on"

### Template Service (Fallback)
The template service is **deterministic** — it generates text using:
- String concatenation with the actual business name
- The customer's actual ratings (highest-rated and lowest-rated questions)
- The customer's actual comment text (verbatim inclusion)
- Keyword-based quality words derived from the average rating

It **cannot hallucinate** because it only concatenates provided data — no generative model is involved.

## Database Persistence

- **Development**: SQLite (`file:./dev.db`) — file-backed, survives server restarts
- **Production**: PostgreSQL via `DATABASE_URL` environment variable

### SQLite Limitations
- **Single-writer**: Only one write transaction at a time (concurrent reads OK)
- **No full-text search**: Topic detection uses application-level keyword matching
- **No JSONB**: JSON data stored as `String` fields, parsed in application code
- **File locking**: The `.db` and `.db-journal` files must not be shared across processes

### PostgreSQL Migration
Prisma abstracts the database layer. To switch:
1. Change `provider` in `schema.prisma` from `"sqlite"` to `"postgresql"`
2. Update `DATABASE_URL` to a PostgreSQL connection string
3. Run `npx prisma migrate dev` to generate PostgreSQL migrations
4. No application code changes required

## Security Model

| Route Pattern | Auth Required | Access Control |
|---------------|--------------|----------------|
| `/api/review/*` | No | Session token (anonymous) |
| `/api/auth/*` | No | Public (login, signup, refresh) |
| `/api/business/:id/*` | Yes (JWT) | `businessAccess` middleware verifies membership |
| `/api/alerts/:id/*` | Yes (JWT) | `businessAccess` middleware |
| `/api/google/:id/*` | Yes (JWT) | `businessAccess` middleware |
| `/api/admin/*` | Yes (JWT) | `requireAdmin` middleware (role === 'ADMIN') |

Admin users bypass `businessAccess` checks and can access any business.

Customer sessions use UUID tokens (not JWTs) — no authentication, no personal data collected. IP addresses are hashed with SHA-256 before storage.

## Performance Characteristics

| Operation | Expected Latency |
|-----------|-----------------|
| Customer page load | <100ms (static assets via Vite) |
| Question loading | <50ms (single Prisma query) |
| AI draft generation (Ollama) | 2-8s (3 parallel requests to local LLM) |
| AI draft generation (template) | <10ms (string concatenation) |
| Dashboard load | <200ms (parallel DB queries) |
| Analytics query | <100ms for <10K events |
| Google sync | 1-10s depending on review count |
| QR generation | <100ms (in-memory rendering) |

### Known Bottlenecks
- Ollama draft generation is the slowest operation — mitigated by showing a loading spinner
- AI analysis batch processing reads all feedback for the period — may slow down with >10K records
- In-memory rate limiter state is lost on server restart

## Demo vs Live Data

- Demo businesses have `isDemo: true` in the database
- Per-business dashboards are naturally isolated by `businessId` — no cross-contamination
- Admin aggregate stats support `?excludeDemo=true` to filter demo data
- The seed creates one demo business ("Bella's Italian Kitchen") with 20 feedback entries
- Demo data is clearly labeled with DEMO badges in the UI
