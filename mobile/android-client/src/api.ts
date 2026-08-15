import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { fetch as expoFetch } from "expo/fetch";
import { NativeModules, Platform } from "react-native";
import { io, type Socket } from "socket.io-client";

export type Role = "CLIENT" | "RIDER" | "ADMIN";
export type Session = { accessToken: string; user: { id: string; name: string; email: string; role: Role } };
export type Place = { lat: number; lng: number; address: string; label?: string; reference?: string | null };
export type Advertisement = { id: string; title: string; description?: string | null; imageUrl?: string | null; actionLabel?: string | null; actionUrl?: string | null; backgroundColor: string; textColor: string; displayOrder: number };
export type LocationPoint = { id?: string; lat: number; lng: number; accuracy?: number | null; heading?: number | null; createdAt?: string; recordedAt?: string };
export type Rider = { name: string; phone?: string | null; riderProfile?: { vehicleModel?: string | null; vehiclePlate?: string | null } | null };
export type Trip = {
  id: string; status: string; originAddress: string; destinationAddress: string;
  originLat: number; originLng: number; destinationLat: number; destinationLng: number;
  estimatedPrice: string; finalPrice?: string | null; proposedPrice?: string | null; currency: string;
  distanceKm: number; estimatedDurationMin: number; riderLat?: number | null; riderLng?: number | null; riderHeading?: number | null; riderAccuracy?: number | null; riderLocationUpdatedAt?: string | null;
  rider?: Rider | null; client?: { name: string; phone?: string | null } | null; notes?: string | null;
  stops?: Place[] | null; rating?: { score: number; comment?: string | null; riderScore?: number | null; riderComment?: string | null } | null;
  locations?: LocationPoint[]; startLocation?: LocationPoint | null; createdAt?: string;
};
export type Offer = { id: string; amount: string; currency: string; rider: { id?: string; name: string } };
export type Quote = { estimatedPrice: number; minimumFare: number; maximumFare: number; currency: string; distanceKm: number; estimatedDurationMin: number };
export type Readiness = { ready: boolean; blockers?: Array<{ code: string; message: string; action?: string }>; activeTrip?: Trip | null; workZone?: { department: string; lat: number; lng: number; updatedAt?: string } | null; subscription?: { plan?: string; expiresAt?: string; daysRemaining: number } | null; dailyQuota?: { limit: number; completed: number; remaining: number; resetsAt: string } | null };

export class MotoYaApiError extends Error {
  constructor(public readonly status: number, public readonly code?: string, message = "No fue posible completar la acción.") {
    super(message);
    this.name = "MotoYaApiError";
  }
}
type NativeHttpResult = { status: number; body: string };
type NativeHttpModule = { request: (url: string, method: string, headers: Record<string, string>, body: string | null) => Promise<NativeHttpResult> };
type ApiResponse = { status: number; ok: boolean; json: () => Promise<any> };
const nativeHttp = NativeModules.MotoYaHttp as NativeHttpModule | undefined;

async function requestApi(url: string, options: RequestInit, headers: Record<string, string>): Promise<ApiResponse> {
  if (Platform.OS === "android" && nativeHttp) {
    const result = await nativeHttp.request(url, options.method || "GET", headers, typeof options.body === "string" ? options.body : null);
    return { status: result.status, ok: result.status >= 200 && result.status < 300, json: async () => JSON.parse(result.body) };
  }
  return expoFetch(url, { ...options, headers }) as unknown as ApiResponse;
}
const apiUrl = String(Constants.expoConfig?.extra?.apiUrl || "https://motoya-api.onrender.com/api").replace(/\/$/, "");
const socketUrl = apiUrl.replace(/\/api$/, "");
let current: Session | null = null;
let socket: Socket | null = null;

export const isActiveTrip = (status: string) => ["REQUESTED", "ACCEPTED", "RIDER_ON_THE_WAY", "RIDER_ARRIVED", "IN_PROGRESS"].includes(status);
export const tripPrice = (trip: Trip) => trip.finalPrice || trip.proposedPrice || trip.estimatedPrice;

export async function restoreSession(): Promise<Session | null> {
  if (current) return current;
  const raw = await AsyncStorage.getItem("motoya.session");
  if (!raw) return null;
  try { current = JSON.parse(raw) as Session; return current; } catch { await AsyncStorage.removeItem("motoya.session"); return null; }
}
export async function setSession(session: Session | null) {
  current = session;
  if (session) await AsyncStorage.setItem("motoya.session", JSON.stringify(session));
  else await AsyncStorage.removeItem("motoya.session");
}
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = await restoreSession();
  let transportError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: ApiResponse;
    try {
      const optionHeaders = options.headers instanceof Headers ? Object.fromEntries(options.headers.entries()) : Array.isArray(options.headers) ? Object.fromEntries(options.headers) : options.headers || {};
      const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json", "Cache-Control": "no-store", Pragma: "no-cache", ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}), ...optionHeaders };
      response = await requestApi(apiUrl + path, options, headers);
    } catch (error: unknown) {
      transportError = error;
      if (attempt < 2) { await wait(350 * (attempt + 1)); continue; }
      const nativeError = error instanceof Error ? error : null;
      const cause = nativeError?.cause instanceof Error ? nativeError.cause.message : "";
      const detail = [nativeError?.message, cause].filter(Boolean).join(" · ");
      console.warn("MotoYa API transport error", { path, apiUrl, attempts: attempt + 1, detail });
      throw new MotoYaApiError(0, "NETWORK_UNREACHABLE", `No pudimos contactar al servidor de MotoYa después de 3 intentos. Esto no es un límite de intentos; verifica tu conexión e inténtalo de nuevo.${detail ? ` Detalle: ${detail}` : ""}`);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const code = typeof body?.error?.code === "string" ? body.error.code : undefined;
      const message = typeof body?.error?.message === "string"
        ? body.error.message
        : response.status === 429
          ? "Demasiados intentos. Espera unos minutos antes de volver a intentarlo."
          : "No fue posible completar la acción.";
      throw new MotoYaApiError(response.status, code, message);
    }
    return body as T;
  }
  throw transportError instanceof Error ? transportError : new MotoYaApiError(0, "NETWORK_UNREACHABLE");
}
export const login = (email: string, password: string) => api<Session>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, remember: true }) });
export const register = (role: Exclude<Role, "ADMIN">, name: string, phone: string, email: string, password: string) => api<Session>(`/auth/register/${role === "CLIENT" ? "client" : "rider"}`, { method: "POST", body: JSON.stringify({ name, phone, email, password }) });
export const logout = async () => { try { await api("/auth/logout", { method: "POST", body: "{}" }); } finally { disconnectSocket(); await setSession(null); } };
export const updateMyProfile = (data: { name?: string; phone?: string }) => api<{ id: string; name: string; email: string; role: Role; status: string; phone?: string | null; clientProfile?: { activationStatus?: string } | null }>("/auth/me", { method: "PATCH", body: JSON.stringify(data) });
export const renameSavedPlace = (currentLabel: string, label: string) => api<Place & { id: string; label: string }>(`/places/${encodeURIComponent(currentLabel)}/label`, { method: "PATCH", body: JSON.stringify({ label }) });export const searchPlaces = (query: string) => api<Place[]>(`/geocoding/search?q=${encodeURIComponent(query.trim())}`);
export const reverseGeocode = (lat: number, lng: number) => api<Place>(`/geocoding/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`);
export const getRoute = (from: Place, to: Place) => api<{ points: Place[] }>("/routing/route", { method: "POST", body: JSON.stringify({ from, to }) });
export const getRouteMatch = (points: Array<Pick<Place, "lat" | "lng">>) => api<{ segments: Place[][] }>("/routing/match", { method: "POST", body: JSON.stringify({ points }) });

export async function connectSocket(onConnectionIssue?: () => void): Promise<Socket | null> {
  const session = await restoreSession();
  if (!session) return null;
  if (socket?.connected) return socket;
  socket?.disconnect();
  socket = io(socketUrl, { transports: ["websocket", "polling"], auth: { token: session.accessToken }, reconnection: true, reconnectionAttempts: 8, timeout: 12_000 });
  socket.on("connect_error", () => onConnectionIssue?.());
  return socket;
}
export const getSocket = () => socket;
export const disconnectSocket = () => { socket?.disconnect(); socket = null; };