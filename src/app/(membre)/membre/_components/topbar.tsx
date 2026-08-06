"use client";

import Link from "next/link";
import { useMembreAuth } from "@/lib/auth/membre-context";
import { AvatarUploader } from "./avatar-uploader";

export function MembreTopbar() {
  const { signOut, claims } = useMembreAuth();
  const expiresAt = new Date(claims.exp * 1000);

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <AvatarUploader size={32} />
        <Link href="/membre" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Caisse Noire — Membre
        </Link>
      </div>
      <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="hidden sm:inline">
          Session jusqu&apos;au{" "}
          {expiresAt.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Se déconnecter
        </button>
      </div>
    </header>
  );
}
