import { z } from 'zod';

// IDs are CUIDs (from Prisma @default(cuid())), not UUIDs
// sessionToken is UUID (generated with uuid v4)
export const submitFeedbackSchema = z.object({
  sessionToken: z.string().uuid(),
  ratings: z.array(z.object({
    questionId: z.string().min(1),
    rating: z.number().int().min(1).max(5),
  })).min(1),
  comment: z.string().max(500).optional(),
});

export const generateDraftsSchema = z.object({
  sessionToken: z.string().uuid(),
});

export const selectDraftSchema = z.object({
  sessionToken: z.string().uuid(),
  draftId: z.string().min(1),
  editedText: z.string().max(2000).optional(),
});

export const handoffSchema = z.object({
  sessionToken: z.string().uuid(),
});

export const trackEventSchema = z.object({
  businessId: z.string().min(1),
  sessionId: z.string().optional(),
  eventType: z.enum([
    'QR_SCANNED', 'PAGE_LOADED', 'SESSION_STARTED',
    'RATING_STARTED', 'RATING_COMPLETED', 'COMMENT_SUBMITTED',
    'DRAFTS_GENERATED', 'DRAFT_SELECTED', 'DRAFT_EDITED', 'GOOGLE_HANDOFF',
  ]),
  metadata: z.record(z.unknown()).optional(),
});
