import {
  mergeTrackingPoints,
  trackingPointFromEvent,
  type TripTrackingEvent,
  type TripTrackingPoint,
} from "@/lib/trip-tracking";

const event = (id: string, recordedAt: string, lat: number): TripTrackingEvent => ({
  tripId: "trip-1",
  clientId: "client-1",
  riderId: "rider-1",
  locationId: id,
  lat,
  lng: -86.2,
  recordedAt,
});

describe("trip tracking history", () => {
  test("keeps one ordered source of truth when a socket point arrives before a refetch", () => {
    const persisted: TripTrackingPoint[] = [
      { id: "a", lat: 12.1, lng: -86.2, createdAt: "2026-07-21T10:00:00.000Z" },
      { id: "b", lat: 12.2, lng: -86.2, createdAt: "2026-07-21T10:00:02.000Z" },
    ];
    const realtime = trackingPointFromEvent(event("c", "2026-07-21T10:00:04.000Z", 12.3));

    expect(mergeTrackingPoints(persisted, [realtime]).map((point) => point.id)).toEqual(["a", "b", "c"]);
  });

  test("does not duplicate a location after Socket.io and the API history deliver the same point", () => {
    const point = trackingPointFromEvent(event("location-1", "2026-07-21T10:00:04.000Z", 12.3));

    const merged = mergeTrackingPoints([point], [point]);

    expect(merged).toHaveLength(1);
    expect(merged[0].lat).toBe(12.3);
  });

  test("orders delayed events by their persisted timestamp instead of arrival time", () => {
    const later = trackingPointFromEvent(event("later", "2026-07-21T10:00:05.000Z", 12.5));
    const earlier = trackingPointFromEvent(event("earlier", "2026-07-21T10:00:03.000Z", 12.3));

    expect(mergeTrackingPoints([later], [earlier]).map((point) => point.id)).toEqual(["earlier", "later"]);
  });
});
