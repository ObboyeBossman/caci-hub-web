"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { LoginScreen } from "@/components/screens/LoginScreen";
import { AdminPortal } from "@/components/screens/AdminPortal";
import { MemberPortal } from "@/components/screens/MemberPortal";
import { CaciLogo } from "@/components/caci/ui";

export default function Home() {
  const { user, setUser, screen } = useApp();
  const [bootstrapping, setBootstrapping] = useState(true);

  // Bootstrap session on first mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.auth.me();
        if (!cancelled) {
          setUser(res.user);
        }
      } catch {
        // ignore — user stays null
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  // Loading splash during bootstrap
  if (bootstrapping) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <CaciLogo size={64} className="animate-pulse-loading" />
        <p className="mt-4 text-[14px] text-n400 animate-pulse-loading">Loading CACI Hub…</p>
      </div>
    );
  }

  // Not logged in → login screen
  if (!user) {
    return <LoginScreen />;
  }

  // Logged in → route to appropriate portal
  if (user.role === "admin") {
    return <AdminPortal screen={screen} />;
  }
  return <MemberPortal screen={screen} />;
}
