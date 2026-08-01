"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, restoreSession, Session } from "@/lib/api";

export function Guard({ roles, children }: { roles: Session["user"]["role"][]; children: React.ReactNode }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Session | null | undefined>();
  const requiredRoles = roles.join(",");

  useEffect(() => {
    let active = true;
    void (async () => {
      const nextSession = getSession() || await restoreSession();
      if (!active) return;
      setCurrent(nextSession);
      if (!nextSession || !requiredRoles.split(",").includes(nextSession.user.role)) router.replace("/login");
    })();
    return () => { active = false; };
  }, [requiredRoles, router]);

  if (!current) return <p className="p-6">Cargando…</p>;
  return <>{children}</>;
}
