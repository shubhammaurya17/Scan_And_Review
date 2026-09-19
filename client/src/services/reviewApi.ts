import api from './api';

export async function getBusinessInfo(slug: string) {
  const { data } = await api.get(`/review/${slug}`);
  return data.data;
}

export async function startSession(slug: string) {
  const { data } = await api.post(`/review/${slug}/session`);
  return data.data;
}

export async function submitFeedback(slug: string, payload: {
  sessionToken: string;
  ratings: Array<{ questionId: string; rating: number }>;
  comment?: string;
}) {
  const { data } = await api.post(`/review/${slug}/feedback`, payload);
  return data.data;
}

export async function generateDrafts(slug: string, sessionToken: string) {
  const { data } = await api.post(`/review/${slug}/drafts`, { sessionToken });
  return data.data;
}

export async function selectDraft(slug: string, payload: {
  sessionToken: string;
  draftId: string;
  editedText?: string;
}) {
  const { data } = await api.post(`/review/${slug}/select`, payload);
  return data.data;
}

export async function recordHandoff(slug: string, sessionToken: string) {
  const { data } = await api.post(`/review/${slug}/handoff`, { sessionToken });
  return data.data;
}

export async function trackEvent(payload: {
  businessId: string;
  sessionId?: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await api.post('/events', payload);
  } catch {
    // Fire-and-forget: don't block customer experience
  }
}
