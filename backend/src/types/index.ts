import { Role, TripStatus, RiderStatus, SubscriptionStatus } from '@prisma/client';

export { Role, TripStatus, RiderStatus, SubscriptionStatus };

export interface JwtPayload {
  userId: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NearbyRidersQuery {
  lat: string;
  lng: string;
  radiusKm?: string;
}

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: Role;
      };
    }
  }
}
