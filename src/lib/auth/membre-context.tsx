"use client";

// MembreAuthContext : authentification membre via JWT custom signé par
// l'Edge Function login-membre.
//
// Le JWT est stocké en sessionStorage (perdu à la fermeture d'onglet, plus
// sûr que localStorage pour ce flow sans refresh). Les claims sont décodés
// côté client à partir du payload base64. Un timer déclenche un signOut
// automatique à l'expiration (12 h max).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMembreClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { MembreClaims } from "./roles";

const STORAGE_KEY = "cn.membre.jwt";

type MembreAuthValue = {
  accessToken: string;
  claims: MembreClaims;
  supabase: SupabaseClient<Database>;
  signOut: (reason?: "manual" | "expired") => void;
};

const MembreAuthContext = createContext<MembreAuthValue | null>(null);

function decodeClaims(token: string): MembreClaims | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    // base64url → base64
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(part.length + ((4 - (part.length % 4)) % 4), "=");
    const json = atob(b64);
    const obj = JSON.parse(json) as Partial<MembreClaims>;
    if (
      obj.app_role === "membre" &&
      typeof obj.caisse_id === "string" &&
      typeof obj.membre_id === "string" &&
      typeof obj.exp === "number"
    ) {
      return obj as MembreClaims;
    }
    return null;
  } catch {
    return null;
  }
}

/** Persiste le JWT et déclenche le rendu de l'app membre. */
export function storeMembreSession(accessToken: string): void {
  sessionStorage.setItem(STORAGE_KEY, accessToken);
}

/** Vide la session sans hook (utilisable côté page de login). */
export function clearMembreSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

type ProviderState =
  | { status: "loading" }
  | { status: "absent" }
  | { status: "ready"; token: string; claims: MembreClaims };

export function MembreAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<ProviderState>({ status: "loading" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydratation au mount + sur événement storage (autres onglets).
  useEffect(() => {
    const load = () => {
      const token = sessionStorage.getItem(STORAGE_KEY);
      if (!token) {
        setState({ status: "absent" });
        return;
      }
      const claims = decodeClaims(token);
      if (!claims || claims.exp * 1000 <= Date.now()) {
        sessionStorage.removeItem(STORAGE_KEY);
        setState({ status: "absent" });
        return;
      }
      setState({ status: "ready", token, claims });
    };
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  // Auto-logout à l'expiration du JWT.
  useEffect(() => {
    if (state.status !== "ready") return;
    const ms = state.claims.exp * 1000 - Date.now();
    if (ms <= 0) return;
    timerRef.current = setTimeout(() => {
      sessionStorage.removeItem(STORAGE_KEY);
      toast.error("Session expirée, reconnectez-vous");
      router.replace("/membre/login");
    }, ms);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, router]);

  // Redirection si pas de session quand on est sous (membre).
  useEffect(() => {
    if (state.status === "absent") {
      router.replace("/membre/login");
    }
  }, [state, router]);

  const signOut = useCallback(
    (reason: "manual" | "expired" = "manual") => {
      sessionStorage.removeItem(STORAGE_KEY);
      if (reason === "expired") toast.error("Session expirée, reconnectez-vous");
      router.replace("/membre/login");
    },
    [router],
  );

  const value = useMemo<MembreAuthValue | null>(() => {
    if (state.status !== "ready") return null;
    return {
      accessToken: state.token,
      claims: state.claims,
      supabase: createMembreClient(state.token),
      signOut,
    };
  }, [state, signOut]);

  if (state.status === "loading" || state.status === "absent" || !value) {
    return null;
  }

  return <MembreAuthContext.Provider value={value}>{children}</MembreAuthContext.Provider>;
}

export function useMembreAuth(): MembreAuthValue {
  const ctx = useContext(MembreAuthContext);
  if (!ctx) {
    throw new Error("useMembreAuth doit être appelé sous <MembreAuthProvider>");
  }
  return ctx;
}
