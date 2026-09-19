import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Endpoints that should NOT trigger token refresh or redirect
const AUTH_ENDPOINTS = ['/auth/login', '/auth/signup', '/auth/me', '/auth/refresh', '/auth/logout'];

// Response interceptor for auth refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';

    // Don't retry or redirect for auth endpoints — just reject
    const isAuthEndpoint = AUTH_ENDPOINTS.some(ep => requestUrl.includes(ep));
    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    // For other 401s, try refreshing the token once
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        return api(originalRequest);
      } catch {
        // Don't redirect — let ProtectedRoute handle it via AuthContext
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
