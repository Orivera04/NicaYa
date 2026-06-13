import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { storage } from '../utils/storage';
import { API_BASE_URL } from '../constants/endpoints';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await storage.get('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = await storage.get('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          await storage.set('accessToken', data.data.accessToken);
          await storage.set('refreshToken', data.data.refreshToken);
          if (original.headers) {
            original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          }
          return api(original);
        } catch {
          await storage.clear();
        }
      }
    }

    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: { name: string; email: string; phone?: string; password: string; role: string }) =>
    api.post('/auth/register', data),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

// Trips
export const tripsApi = {
  create: (data: {
    originLat: number;
    originLng: number;
    originAddress: string;
    destLat: number;
    destLng: number;
    destAddress: string;
    negotiatedPrice?: number;
  }) => api.post('/trips', data),
  accept: (id: string) => api.put(`/trips/${id}/accept`),
  updateStatus: (id: string, status: string) => api.put(`/trips/${id}/status`, { status }),
  rate: (id: string, rating: number) => api.post(`/trips/${id}/rate`, { rating }),
  list: (page = 1) => api.get('/trips', { params: { page } }),
};

// Riders
export const ridersApi = {
  nearby: (lat: number, lng: number) =>
    api.get('/riders/nearby', { params: { lat, lng } }),
  setAvailability: (isAvailable: boolean) =>
    api.put('/riders/availability', { isAvailable }),
  updateLocation: (lat: number, lng: number) =>
    api.put('/riders/location', { lat, lng }),
};
