"use client";

// AdminAuthContext : expose la session Supabase Auth + droits dérivés
// (super-admin, caisses où l'utilisateur est créateur ou admin).
//
// L'état initial est hydraté côté serveur via le layout (admin) qui passe
// `initialState`. Le provider écoute ensuite onAuthStateChange pour détecter
// les déconnexions (autre onglet, expiration, signOut manuel).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { AdminInitialState } from "./roles";

type AdminAuthValue = AdminInitialState & {
  supabase: SupabaseClient<Database>;
  signOut: () => Promise<void>;
  refresh: () => void;
};

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({
  initialState,
  children,
}: {
  initialState: AdminInitialState;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [state] = useState<AdminInitialState>(initialState);

  // Détecte les SIGNED_OUT (autre onglet, expiration) et redirige.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, router]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  }, [supabase, router]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const value = useMemo<AdminAuthValue>(
    () => ({ ...state, supabase, signOut, refresh }),
    [state, supabase, signOut, refresh],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth doit être appelé sous <AdminAuthProvider>");
  }
  return ctx;
}
