const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export type Session = {
  accessToken: string;
  user: { id: string; name: string; email: string; role: "CLIENT" | "RIDER" | "ADMIN" };
};
export type ApiError = Error & { status?: number; code?: string };
export type ApiRequestOptions = RequestInit & { retryOnNetwork?: boolean };

let session: Session | null = null;
let refreshInFlight: Promise<Session | null> | null = null;

const pause = (milliseconds: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));
const transientStatus = (status: number) => [502, 503, 504].includes(status);

const unavailable = (): ApiError => {
  const error = new Error("No pudimos conectarnos con MotoYa. Verifica tu conexión e inténtalo de nuevo.") as ApiError;
  error.name = "ApiError";
  error.code = "NETWORK_UNAVAILABLE";
  return error;
};

export const isNetworkUnavailable = (error: unknown): error is ApiError =>
  Boolean(error && typeof error === "object" && "code" in error && (error as ApiError).code === "NETWORK_UNAVAILABLE");

export const getSession = (): Session | null => session;

/** Access tokens are intentionally memory-only. Refresh credentials are HttpOnly cookies. */
export const setSession = (nextSession: Session, _remember?: boolean): void => {
  session = nextSession;
};

export async function restoreSession(): Promise<Session | null> {
  if (session) return session;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(`${base}/auth/refresh`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          if (transientStatus(response.status)) {
            if (attempt === 0) {
              await pause(700);
              continue;
            }
            throw unavailable();
          }
          if (!response.ok) return null;
          const nextSession = await response.json() as Session;
          session = nextSession;
          return nextSession;
        } catch {
          if (attempt === 0) {
            await pause(700);
            continue;
          }
          throw unavailable();
        }
      }
      return null;
    })().finally(() => { refreshInFlight = null; });
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

export async function api<T>(path: string, options: ApiRequestOptions = {}) {
  const { retryOnNetwork = false, ...requestOptions } = options;
  const method = (requestOptions.method || "GET").toUpperCase();
  // Retriable reads do not change state. POST/PUT/PATCH requests stay as a
  // single attempt unless the caller explicitly marks an operation as safe.
  const attempts = retryOnNetwork || method === "GET" || method === "HEAD" ? 3 : 1;
  const request = async (current: Session | null) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(base + path, {
          ...requestOptions,
          credentials: "include",
          headers: headersFor(current, requestOptions.headers),
        });
        if (transientStatus(response.status) && attempt + 1 < attempts) {
          await pause(500 * (attempt + 1));
          continue;
        }
        return response;
      } catch {
        if (attempt + 1 < attempts) await pause(500 * (attempt + 1));
        else throw unavailable();
      }
    }
    throw unavailable();
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
