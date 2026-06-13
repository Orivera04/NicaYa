import { api } from './axios';
import type {
  DashboardMetrics,
  RiderProfile,
  Trip,
  Subscription,
  PaginatedResult,
  User,
} from '../types';

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ success: boolean; data: { user: User; accessToken: string; refreshToken: string } }>(
      '/auth/login',
      { email, password }
    ),
};

// Dashboard
export const dashboardApi = {
  get: () =>
    api.get<{
      success: boolean;
      data: { metrics: DashboardMetrics; charts: { tripsPerDay: Record<string, number> } };
    }>('/admin/dashboard'),
};

// Riders
export const ridersApi = {
  list: (page = 1, limit = 20, status?: string) =>
    api.get<{ success: boolean; data: PaginatedResult<RiderProfile> }>('/admin/riders', {
      params: { page, limit, status },
    }),
  approve: (id: string) => api.put(`/admin/riders/${id}/approve`),
  setStatus: (id: string, status: string) => api.put(`/admin/riders/${id}/status`, { status }),
};

// Clients
export const clientsApi = {
  list: (page = 1, limit = 20) =>
    api.get<{ success: boolean; data: PaginatedResult<User> }>('/admin/clients', {
      params: { page, limit },
    }),
};

// Trips
export const tripsApi = {
  list: (page = 1, limit = 20) =>
    api.get<{ success: boolean; data: PaginatedResult<Trip> }>('/admin/trips', {
      params: { page, limit },
    }),
  cancel: (id: string) => api.put(`/admin/trips/${id}/cancel`),
};

// Config
export const configApi = {
  get: () => api.get<{ success: boolean; data: { config: Record<string, string> } }>('/admin/config'),
  update: (config: Record<string, string>) => api.put('/admin/config', config),
};

// Subscriptions
export const subscriptionsApi = {
  list: (page = 1, limit = 20) =>
    api.get<{ success: boolean; data: PaginatedResult<Subscription> }>('/admin/subscriptions', {
      params: { page, limit },
    }),
  create: (riderId: string, months = 1) =>
    api.post('/admin/subscriptions', { riderId, months }),
};
