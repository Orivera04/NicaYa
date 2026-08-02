"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, isNetworkUnavailable, restoreSession, Session } from "@/lib/api";

export function Guard({ roles, children }: { roles: Session["user"]["role"][]; children: React.ReactNode }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Session | null | undefined>();
  const [connectionError, setConnectionError] = useState(false);
  const requiredRoles = roles.join(",");

  const resolveSession = useCallback(async () => {
    setCurrent(undefined);
    setConnectionError(false);
    try {
      const nextSession = getSession() || await restoreSession();
      setCurrent(nextSession);
      if (!nextSession || !requiredRoles.split(",").includes(nextSession.user.role)) router.replace("/login");
    } catch (error) {
      if (isNetworkUnavailable(error)) {
        setCurrent(null);
        setConnectionError(true);
        return;
      }
      setCurrent(null);
      router.replace("/login");
    }
  }, [requiredRoles, router]);

  useEffect(() => {
    void resolveSession().catch(() => undefined);
  }, [resolveSession]);

  if (current === undefined) return <p className="p-6 text-sm text-slate-500">Cargando tu sesión…</p>;
  if (connectionError) return <div className="m-6 max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><b>No pudimos cargar tu sesión.</b><p className="mt-1">Revisa tu conexión y vuelve a intentarlo.</p><button className="primary mt-3" onClick={() => void resolveSession()}>Reintentar</button></div>;
  if (!current) return null;
  return <>{children}</>;
}
