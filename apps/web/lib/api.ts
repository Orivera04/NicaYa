const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export type Session = {
  accessToken: string;
  user: { id: string; name: string; email: string; role: "CLIENT" | "RIDER" | "ADMIN" };
};
export type ApiError = Error & { status?: number; code?: string };

let session: Session | null = null;
let refreshInFlight: Promise<Session | null> | null = null;

export const getSession = (): Session | null => session;

/** Access tokens are intentionally memory-only. Refresh credentials are HttpOnly cookies. */
export const setSession = (nextSession: Session, _remember?: boolean): void => {
  session = nextSession;
};

export async function restoreSession(): Promise<Session | null> {
  if (session) return session;
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${base}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).then(async (response) => {
      if (!response.ok) return null;
      const nextSession = await response.json() as Session;
      session = nextSession;
      return nextSession;
    }).catch(() => null).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function logout(): Promise<void> {
  session = null;
  refreshInFlight = null;
  try {
    await fetch(`${base}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      keepalive: true,
    });
  } catch {
    // Local access state was already cleared. The server cookie expires on its
    // next successful logout/refresh request if the network is unavailable.
  }
}

const headersFor = (current: Session | null, headers?: HeadersInit) => ({
  "Content-Type": "application/json",
  ...(current ? { Authorization: `Bearer ${current.accessToken}` } : {}),
  ...headers,
});

export async function api<T>(path: string, options: RequestInit = {}) {
  const request = async (current: Session | null) => {
    try {
      return await fetch(base + path, {
        ...options,
        credentials: "include",
        headers: headersFor(current, options.headers),
      });
    } catch {
      const error = new Error("No pudimos conectarnos con MotoYa. Reintentaremos al recuperar la conexión.") as ApiError;
      error.name = "ApiError";
      error.code = "NETWORK_UNAVAILABLE";
      throw error;
    }
  };

  let current = getSession();
  let response = await request(current);
  if (response.status === 401 && path !== "/auth/refresh" && path !== "/auth/login") {
    current = await restoreSession();
    if (current) response = await request(current);
    else session = null;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = new Error(body?.error?.message || "No fue posible completar la acción.") as ApiError;
    error.name = "ApiError";
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return response.status === 204 ? null as T : response.json() as Promise<T>;
}
