import api from './api';

export async function getBusiness(businessId: string) {
  const { data } = await api.get(`/business/${businessId}`);
  return data.data;
}

export async function updateBusiness(businessId: string, payload: Record<string, unknown>) {
  const { data } = await api.put(`/business/${businessId}`, payload);
  return data.data;
}

export async function getQuestions(businessId: string) {
  const { data } = await api.get(`/business/${businessId}/questions`);
  return data.data;
}

export async function createQuestion(businessId: string, payload: { text: string; sortOrder?: number }) {
  const { data } = await api.post(`/business/${businessId}/questions`, payload);
  return data.data;
}

export async function updateQuestion(businessId: string, questionId: string, payload: Record<string, unknown>) {
  const { data } = await api.put(`/business/${businessId}/questions/${questionId}`, payload);
  return data.data;
}

export async function deleteQuestion(businessId: string, questionId: string) {
  const { data } = await api.delete(`/business/${businessId}/questions/${questionId}`);
  return data.data;
}

export async function reorderQuestions(businessId: string, questionIds: string[]) {
  const { data } = await api.put(`/business/${businessId}/questions/reorder`, { questionIds });
  return data.data;
}

export async function getFeedback(businessId: string, params?: { page?: number; pageSize?: number; rating?: number }) {
  const { data } = await api.get(`/business/${businessId}/feedback`, { params });
  return data;
}

export async function getAnalytics(businessId: string, period?: string) {
  const { data } = await api.get(`/business/${businessId}/analytics`, { params: { period } });
  return data.data;
}

export async function getAIInsights(businessId: string) {
  const { data } = await api.get(`/business/${businessId}/ai/insights`);
  return data.data;
}

export async function getCategories() {
  const { data } = await api.get('/business/categories');
  return data.data;
}

export async function getQRConfig(businessId: string) {
  const { data } = await api.get(`/business/${businessId}/qr/config`);
  return data.data;
}

export async function resetData(businessId: string) {
  const { data } = await api.delete(`/business/${businessId}/reset-data`);
  return data.data;
}

// Insight chips
export async function getInsights(businessId: string) {
  const res = await api.get(`/business/${businessId}/insights`);
  return res.data;
}

export async function createInsight(businessId: string, payload: { label: string }) {
  const res = await api.post(`/business/${businessId}/insights`, payload);
  return res.data;
}

export async function updateInsight(businessId: string, insightId: string, payload: { label?: string; isActive?: boolean }) {
  const res = await api.put(`/business/${businessId}/insights/${insightId}`, payload);
  return res.data;
}

export async function deleteInsight(businessId: string, insightId: string) {
  const res = await api.delete(`/business/${businessId}/insights/${insightId}`);
  return res.data;
}

export async function reorderInsights(businessId: string, insightIds: string[]) {
  const res = await api.put(`/business/${businessId}/insights/reorder`, { insightIds });
  return res.data;
}

export async function resetInsights(businessId: string) {
  const res = await api.post(`/business/${businessId}/insights/reset`);
  return res.data;
}
