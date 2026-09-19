export const MAX_QUESTIONS = 5;
export const MIN_QUESTIONS = 3;
export const DRAFT_COUNT = 3;
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const MAX_COMMENT_LENGTH = 500;
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DRAFT_STYLES = ['PROFESSIONAL', 'FRIENDLY', 'CONCISE'] as const;

export const DRAFT_STYLE_LABELS: Record<string, string> = {
  PROFESSIONAL: 'Balanced & Authentic',
  FRIENDLY: 'Warm & Natural',
  CONCISE: 'Short & Direct',
};

export const FUNNEL_EVENT_ORDER = [
  'QR_SCANNED',
  'PAGE_LOADED',
  'SESSION_STARTED',
  'RATING_STARTED',
  'RATING_COMPLETED',
  'COMMENT_SUBMITTED',
  'DRAFTS_GENERATED',
  'DRAFT_SELECTED',
  'GOOGLE_HANDOFF',
] as const;

export const DEFAULT_CATEGORIES = [
  { name: 'Restaurant', slug: 'restaurant' },
  { name: 'Bakery', slug: 'bakery' },
  { name: 'Boutique', slug: 'boutique' },
  { name: 'Salon', slug: 'salon' },
  { name: 'Hotel', slug: 'hotel' },
  { name: 'Dental Office', slug: 'dental-office' },
  { name: 'Auto Repair', slug: 'auto-repair' },
  { name: 'Retail', slug: 'retail' },
] as const;
