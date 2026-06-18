"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import type { AdminRole } from "@/lib/auth/roles";

type NavItem = { slug: string; label: string; soon?: boolean };

const NAV: NavItem[] = [
  { slug: "", label: "Tableau de bord" },
  { slug: "membres", label: "Membres" },
  { slug: "motifs", label: "Motifs" },
  { slug: "ecritures", label: "Écritures" },
  { slug: "audit", label: "Audit log" },
  { slug: "parametres", label: "Paramètres" },
];

export function CaisseSidebar({
  caisseId,
  nom,
  code,
  cloturee,
  role,
}: {
  caisseId: string;
  nom: string;
  code: string;
  cloturee: boolean;
  role: AdminRole;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const base = `/admin/caisses/${caisseId}`;
  const items = NAV.map((n) => {
    const href = n.slug ? `${base}/${n.slug}` : base;
    const active =
      pathname === href || (n.slug && pathname.startsWith(`${href}/`));
    return { ...n, href, active };
  });

  const onCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copié");
    } catch {
      toast.error("Copie impossible");
    }
  };

  const sidebarContent = (
    <>
      <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <Link
          href="/admin"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Mes caisses
        </Link>
        <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{nom}</div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="font-mono text-zinc-600 dark:text-zinc-400">{code}</span>
          <button
            type="button"
            onClick={onCopyCode}
            className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Copier
          </button>
        </div>
        {cloturee && (
          <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
            clôturée
          </div>
        )}
        <div className="mt-2 inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {role}
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
              item.active
                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <span>{item.label}</span>
            {item.soon && (
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                bientôt
              </span>
            )}
          </Link>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Bouton drawer mobile */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2 lg:hidden dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          className="rounded-md border border-zinc-300 p-2 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ☰
        </button>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{nom}</span>
        <span className="w-9" />
      </div>

      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex dark:border-zinc-800 dark:bg-zinc-900">
        {sidebarContent}
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="relative flex w-64 flex-col bg-white shadow-xl dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Fermer"
            >
              ✕
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
