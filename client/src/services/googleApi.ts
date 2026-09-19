import api from './api';

export const googleApi = {
  getConnectionStatus: (businessId: string) =>
    api.get(`/google/${businessId}/google/status`),

  getAuthUrl: (businessId: string) =>
    api.get(`/google/${businessId}/google/auth-url`),

  disconnect: (businessId: string) =>
    api.post(`/google/${businessId}/google/disconnect`),

  syncReviews: (businessId: string) =>
    api.post(`/google/${businessId}/google/sync`),

  getReviews: (businessId: string, page = 1) =>
    api.get(`/google/${businessId}/google/reviews`, { params: { page } }),

  generateReply: (businessId: string, reviewId: string, tone: string) =>
    api.post(`/google/${businessId}/google/reviews/${reviewId}/generate-reply`, { tone }),

  postReply: (businessId: string, reviewId: string, replyText: string) =>
    api.post(`/google/${businessId}/google/reviews/${reviewId}/post-reply`, { replyText }),

  generateAIReply: (businessId: string, reviewText: string, tone: string) =>
    api.post(`/google/${businessId}/ai/reply`, { reviewText, tone }),
};
