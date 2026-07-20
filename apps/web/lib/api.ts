const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
export type Session = { accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: "CLIENT" | "RIDER" | "ADMIN" } };
export type ApiError = Error & { status?: number; code?: string };
type TokenPair = Pick<Session, "accessToken" | "refreshToken">;
let refreshInFlight: Promise<Session | null> | null = null;

const SESSION_KEY = "motoya-session";
const REMEMBER_KEY = "motoya-remember";
const rememberedStore = () => (localStorage.getItem(REMEMBER_KEY) === "0" ? sessionStorage : localStorage);

export const getSession = (): Session | null => {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null") as Session | null; } catch { logout(); return null; }
};
export const setSession = (session: Session, remember?: boolean) => {
  if (typeof remember === "boolean") localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  const store = rememberedStore();
  store.setItem(SESSION_KEY, JSON.stringify(session));
  (store === localStorage ? sessionStorage : localStorage).removeItem(SESSION_KEY);
};
export const logout = () => { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(REMEMBER_KEY); };
const headersFor = (session: Session | null, headers?: HeadersInit) => ({ "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}), ...headers });

async function refreshSession(current: Session): Promise<Session | null> {
  if (!refreshInFlight) refreshInFlight = fetch(`${base}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: current.refreshToken }) }).then(async (response) => {
    if (!response.ok) return null;
    const tokens = await response.json() as TokenPair;
    const next = { ...current, ...tokens }; setSession(next); return next;
  }).catch(() => null).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function api<T>(path: string, options: RequestInit = {}) {
  let session = getSession();
  let response = await fetch(base + path, { ...options, headers: headersFor(session, options.headers) });
  if (response.status === 401 && session && path !== "/auth/refresh") {
    session = await refreshSession(session);
    if (session) response = await fetch(base + path, { ...options, headers: headersFor(session, options.headers) });
    else logout();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = new Error(body?.error?.message || "No fue posible completar la accion.") as ApiError;
    error.name = "ApiError";
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return response.status === 204 ? null as T : response.json() as Promise<T>;
}
