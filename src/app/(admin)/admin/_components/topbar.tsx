"use client";

import Link from "next/link";
import { useAdminAuth } from "@/lib/auth/admin-context";

export function AdminTopbar({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { signOut } = useAdminAuth();

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <Link href="/admin" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Caisse Noire — Admin
      </Link>
      <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
        {isSuperAdmin && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
            super-admin
          </span>
        )}
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Se déconnecter
        </button>
      </div>
    </header>
  );
}
