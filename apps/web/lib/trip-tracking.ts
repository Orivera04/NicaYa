export type TripTrackingPoint = {
  id?: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  createdAt: string;
};

export type TripTrackingEvent = {
  tripId: string;
  clientId?: string;
  riderId?: string;
  locationId?: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  recordedAt: string;
};

export const TRACKING_HISTORY_LIMIT = 720;

const timestamp = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const pointKey = (point: TripTrackingPoint) => point.id || `${point.createdAt}:${point.lat.toFixed(6)}:${point.lng.toFixed(6)}`;

/**
 * Merges a GET snapshot and Socket deltas without allowing an older response
 * to remove a newer confirmed position. PostgreSQL remains the source of
 * truth; this merely makes delivery order irrelevant in the UI.
 */
export const mergeTrackingPoints = (current: TripTrackingPoint[] = [], incoming: TripTrackingPoint[] = [], limit = TRACKING_HISTORY_LIMIT): TripTrackingPoint[] => {
  const points = new Map<string, TripTrackingPoint>();
  [...current, ...incoming].forEach((point) => {
    const key = pointKey(point);
    const previous = points.get(key);
    if (!previous || timestamp(point.createdAt) >= timestamp(previous.createdAt)) points.set(key, point);
  });

  return [...points.values()]
    .sort((left, right) => timestamp(left.createdAt) - timestamp(right.createdAt))
    .slice(-limit);
};

export const trackingPointFromEvent = (event: TripTrackingEvent): TripTrackingPoint => ({
  id: event.locationId,
  lat: event.lat,
  lng: event.lng,
  accuracy: event.accuracy,
  heading: event.heading,
  createdAt: event.recordedAt,
});

export const newestTrackingPoint = (points: TripTrackingPoint[] = []) => points.at(-1) || null;
