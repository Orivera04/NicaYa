const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
export type Session = { accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: "CLIENT" | "RIDER" | "ADMIN" } };
type TokenPair = Pick<Session, "accessToken" | "refreshToken">;
let refreshInFlight: Promise<Session | null> | null = null;

export const getSession = (): Session | null => {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("motoya-session") || "null") as Session | null; } catch { localStorage.removeItem("motoya-session"); return null; }
};
export const setSession = (session: Session) => localStorage.setItem("motoya-session", JSON.stringify(session));
export const logout = () => localStorage.removeItem("motoya-session");
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
  if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error?.message || "No fue posible completar la accion."); }
  return response.status === 204 ? null as T : response.json() as Promise<T>;
}
