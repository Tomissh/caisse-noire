// Dashboard super-admin : KPIs globaux et liens vers les sections.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function SuperAdminHome() {
  const supabase = await createClient();
  const [caissesRes, caissesClotureesRes, saRes, membresRes] = await Promise.all([
    supabase.from("caisses").select("id", { count: "exact", head: true }),
    supabase
      .from("caisses")
      .select("id", { count: "exact", head: true })
      .not("cloturee_at", "is", null),
    supabase.from("super_admins").select("user_id", { count: "exact", head: true }),
    supabase.from("membres").select("id", { count: "exact", head: true }).eq("actif", true),
  ]);

  const nbCaisses = caissesRes.count ?? 0;
  const nbCloturees = caissesClotureesRes.count ?? 0;
  const nbSa = saRes.count ?? 0;
  const nbMembres = membresRes.count ?? 0;

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Espace super-administrateur
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Vue globale de toutes les caisses, gestion des comptes et audit log.
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Caisses" value={String(nbCaisses)} />
          <Kpi label="Dont clôturées" value={String(nbCloturees)} />
          <Kpi label="Super-admins" value={String(nbSa)} />
          <Kpi label="Membres actifs" value={String(nbMembres)} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <SectionLink
            href="/admin/super/caisses"
            title="Toutes les caisses"
            description="Vue globale, réouverture des caisses clôturées."
          />
          <SectionLink
            href="/admin/super/admins"
            title="Super-administrateurs"
            description="Ajouter / retirer le rôle super-admin à un compte existant."
          />
          <SectionLink
            href="/admin/super/invite"
            title="Inviter un admin"
            description="Créer un compte Supabase Auth pour un nouvel administrateur de caisse."
          />
          <SectionLink
            href="/admin/super/audit"
            title="Audit global"
            description="Toutes les actions enregistrées, toutes caisses confondues."
          />
        </section>
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function SectionLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
    >
      <div className="font-medium text-zinc-900 dark:text-zinc-50">{title}</div>
      <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{description}</div>
    </Link>
  );
}
