import api from './api';

export const adminApi = {
  getStats: (excludeDemo = false) => api.get('/admin/stats', { params: { excludeDemo } }),
  getHealth: () => api.get('/admin/health'),
  getAIConfig: () => api.get('/admin/ai/config'),

  // Businesses
  listBusinesses: (page = 1) => api.get('/admin/businesses', { params: { page } }),
  createBusiness: (data: any) => api.post('/admin/businesses', data),
  updateBusiness: (id: string, data: any) => api.put(`/admin/businesses/${id}`, data),
  deleteBusiness: (id: string) => api.delete(`/admin/businesses/${id}`),

  // Categories
  listCategories: () => api.get('/admin/categories'),
  createCategory: (data: { name: string; slug: string }) => api.post('/admin/categories', data),
  updateCategory: (id: string, data: any) => api.put(`/admin/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/admin/categories/${id}`),

  // Templates
  getTemplates: (categoryId: string) => api.get(`/admin/categories/${categoryId}/templates`),
  createTemplate: (categoryId: string, data: any) => api.post(`/admin/categories/${categoryId}/templates`, data),
  updateTemplate: (categoryId: string, templateId: string, data: any) => api.put(`/admin/categories/${categoryId}/templates/${templateId}`, data),
  deleteTemplate: (categoryId: string, templateId: string) => api.delete(`/admin/categories/${categoryId}/templates/${templateId}`),

  // Users
  listUsers: () => api.get('/admin/users'),
};
