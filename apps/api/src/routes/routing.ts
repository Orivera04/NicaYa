import { z } from "zod";
import { env } from "../config.js";
import { fail } from "../lib/error.js";
import { authenticate } from "../middleware/auth.js";
import { safeRouter } from "../middleware/safe-router.js";

type Point = { lat: number; lng: number };
type Cached<T> = { expiresAt: number; value: T };

const pointSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});
const routeSchema = z.object({ from: pointSchema, to: pointSchema });
const matchSchema = z.object({ points: z.array(pointSchema).min(2).max(90) });
const routeCache = new Map<string, Cached<Point[]>>();
const matchCache = new Map<string, Cached<Point[][]>>();

const keyFor = (points: Point[]) => points.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join(";");
const fromCoordinates = (coordinates: unknown): Point[] => Array.isArray(coordinates)
  ? coordinates.flatMap((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2 && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1])
    ? [{ lng: Number(coordinate[0]), lat: Number(coordinate[1]) }]
    : [])
  : [];

const readCached = <T>(cache: Map<string, Cached<T>>, key: string) => {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) cache.delete(key);
    return null;
  }
  return entry.value;
};
const cache = <T>(store: Map<string, Cached<T>>, key: string, value: T, ttlMs: number) => {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  // A small bounded in-memory cache protects the public routing provider
  // without becoming a second source of state.
  if (store.size > 400) store.delete(store.keys().next().value as string);
  return value;
};

const requestProvider = async (path: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(`${env.ROUTING_PROVIDER_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Routing provider returned ${response.status}`);
    return await response.json() as Record<string, unknown>;
  } catch {
    return fail(503, "ROUTING_UNAVAILABLE", "No pudimos calcular la ruta en este momento. Intenta nuevamente.");
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Routing is proxied by the API rather than requested directly by the browser.
 * This centralizes provider failures, makes a later provider swap safe and
 * prevents every mobile tab from independently retrying the same route.
 */
export const routingRouter = safeRouter();
routingRouter.use(authenticate);

routingRouter.post("/route", async (req, res) => {
  const { from, to } = routeSchema.parse(req.body);
  const key = keyFor([from, to]);
  const cached = readCached(routeCache, key);
  if (cached) return res.json({ points: cached, cached: true });

  const data = await requestProvider(`/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`);
  const routes = data.routes as Array<{ geometry?: { coordinates?: unknown } }> | undefined;
  const points = fromCoordinates(routes?.[0]?.geometry?.coordinates);
  if (points.length < 2) return fail(503, "ROUTING_UNAVAILABLE", "No fue posible obtener una ruta transitable.");
  return res.json({ points: cache(routeCache, key, points, 3 * 60_000), cached: false });
});

routingRouter.post("/match", async (req, res) => {
  const { points } = matchSchema.parse(req.body);
  const key = keyFor(points);
  const cached = readCached(matchCache, key);
  if (cached) return res.json({ segments: cached, cached: true });

  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(";");
  const data = await requestProvider(`/match/v1/driving/${coordinates}?overview=full&geometries=geojson&tidy=true&gaps=split`);
  const matchings = data.matchings as Array<{ geometry?: { coordinates?: unknown } }> | undefined;
  const segments = (matchings || []).map((matching) => fromCoordinates(matching.geometry?.coordinates)).filter((segment) => segment.length >= 2);
  if (!segments.length) return fail(503, "ROUTING_UNAVAILABLE", "No pudimos ajustar el recorrido a las calles.");
  return res.json({ segments: cache(matchCache, key, segments, 45_000), cached: false });
});
