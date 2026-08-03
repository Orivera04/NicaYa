import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

export type Role = "CLIENT" | "RIDER";
export type Session = { accessToken: string; user: { id: string; name: string; email: string; role: Role } };
export type Place = { lat: number; lng: number; address: string };
export type Trip = {
  id: string; status: string; originAddress: string; destinationAddress: string;
  originLat: number; originLng: number; destinationLat: number; destinationLng: number;
  estimatedPrice: string; finalPrice?: string | null; proposedPrice?: string | null; currency: string;
  distanceKm: number; estimatedDurationMin: number; riderLat?: number | null; riderLng?: number | null;
  rider?: { name: string; phone?: string | null; riderProfile?: { vehicleModel?: string | null; vehiclePlate?: string | null } | null } | null;
  notes?: string | null; stops?: Place[] | null; rating?: { score: number; comment?: string | null; riderScore?: number | null; riderComment?: string | null } | null;
  locations?: Array<{ id?: string; lat: number; lng: number; accuracy?: number | null; heading?: number | null; createdAt?: string }>;
  startLocation?: { lat: number; lng: number; createdAt?: string } | null;
  client?: { name: string; phone?: string | null } | null;
};
export type Offer = { id: string; amount: string; currency: string; rider: { name: string } };

const apiUrl = String(Constants.expoConfig?.extra?.apiUrl || "https://motoya-api.onrender.com/api").replace(/\/$/, "");
let current: Session | null = null;

export async function restoreSession(): Promise<Session | null> {
  if (current) return current;
  const raw = await AsyncStorage.getItem("motoya.session");
  if (!raw) return null;
  try { current = JSON.parse(raw) as Session; return current; } catch { await AsyncStorage.removeItem("motoya.session"); return null; }
}
export async function setSession(session: Session | null) { current = session; if (session) await AsyncStorage.setItem("motoya.session", JSON.stringify(session)); else await AsyncStorage.removeItem("motoya.session"); }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = await restoreSession();
  const response = await fetch(apiUrl + path, { ...options, headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}), ...(options.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message || "No fue posible completar la acción.");
  return body as T;
}
export const login = (email: string, password: string) => api<Session>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, remember: true }) });
export const register = (role: Role, name: string, email: string, password: string) => api<Session>(`/auth/register/${role === "CLIENT" ? "client" : "rider"}`, { method: "POST", body: JSON.stringify({ name, email, password }) });
export const logout = async () => { try { await api("/auth/logout", { method: "POST", body: "{}" }); } finally { await setSession(null); } };
export const searchPlaces = (query: string) => api<Place[]>(`/geocoding/search?q=${encodeURIComponent(query.trim())}`);
