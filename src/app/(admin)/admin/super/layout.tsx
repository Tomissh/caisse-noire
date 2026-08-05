// Layout super-admin : garde super-admin + sous-nav.

import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/guard-admin";
import { AdminTopbar } from "../_components/topbar";

const NAV = [
  { href: "/admin/super", label: "Vue d'ensemble" },
  { href: "/admin/super/caisses", label: "Toutes les caisses" },
  { href: "/admin/super/admins", label: "Super-administrateurs" },
  { href: "/admin/super/invite", label: "Inviter un admin" },
  { href: "/admin/super/audit", label: "Audit global" },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSuperAdmin } = await requireSuperAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <AdminTopbar isSuperAdmin={isSuperAdmin} />
      <nav className="border-b border-amber-200 bg-amber-50 px-6 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-semibold text-amber-900 dark:text-amber-200">
            Super-admin
          </span>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-amber-800 hover:text-amber-900 hover:underline dark:text-amber-300 dark:hover:text-amber-100"
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/admin"
            className="ml-auto text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Retour
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
