import api from './api';

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password });
  return data.data;
}

export async function signup(payload: {
  email: string;
  password: string;
  name: string;
  businessName: string;
  categoryId?: string;
}) {
  const { data } = await api.post('/auth/signup', payload);
  return data.data;
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data.data;
}
