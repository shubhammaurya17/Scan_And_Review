import api from './api';

export const alertApi = {
  getAlerts: (businessId: string, params?: { page?: number; type?: string; unread?: boolean }) =>
    api.get(`/alerts/${businessId}/alerts`, { params }),

  getUnreadCount: (businessId: string) =>
    api.get(`/alerts/${businessId}/alerts/unread-count`),

  markRead: (businessId: string, alertId: string) =>
    api.put(`/alerts/${businessId}/alerts/${alertId}/read`),

  markAllRead: (businessId: string) =>
    api.put(`/alerts/${businessId}/alerts/read-all`),

  deleteAlert: (businessId: string, alertId: string) =>
    api.delete(`/alerts/${businessId}/alerts/${alertId}`),
};
