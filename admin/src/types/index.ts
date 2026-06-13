export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'CLIENT' | 'RIDER' | 'ADMIN';
  createdAt: string;
}

export interface RiderProfile {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'INACTIVE';
  avgRating: number;
  totalRides: number;
  subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  subscriptionExpiresAt?: string;
  isAvailable: boolean;
  latitude?: number;
  longitude?: number;
  user: Pick<User, 'id' | 'name' | 'email' | 'phone' | 'createdAt'>;
}

export interface Trip {
  id: string;
  clientId: string;
  riderId?: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  originAddress: string;
  destAddress: string;
  suggestedPrice: number;
  negotiatedPrice?: number;
  finalPrice?: number;
  currency: string;
  distance?: number;
  clientRating?: number;
  riderRating?: number;
  createdAt: string;
  client: { id: string; name: string };
  rider?: { id: string; name: string };
}

export interface Subscription {
  id: string;
  riderId: string;
  startDate: string;
  endDate: string;
  amount: number;
  currency: string;
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  createdAt: string;
  rider: RiderProfile & { user: Pick<User, 'name' | 'email'> };
}

export interface DashboardMetrics {
  activeRiders: number;
  expiredSubscriptions: number;
  totalClients: number;
  tripsToday: number;
  completedTrips: number;
  subscriptionRevenue: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN';
}
