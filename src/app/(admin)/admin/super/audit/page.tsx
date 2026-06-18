// Audit log global (toutes caisses).
// Réutilise les helpers et le composant FilterBar de l'audit par caisse.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTION_OPTIONS,
  formatAuditAction,
} from "../../caisses/[caisseId]/audit/_format";
import { AuditFilterBar } from "../../caisses/[caisseId]/audit/_components/filter-bar";

function parseStr(v: string | string[] | undefined): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}
function parseLimit(v: string | string[] | undefined): number {
  if (typeof v !== "string") return 50;
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n <= 0) return 50;
  return Math.min(n, 1000);
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function GlobalAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const action = parseStr(sp.action);
  const from = parseStr(sp.from);
  const to = parseStr(sp.to);
  const acteur = parseStr(sp.acteur);
  const limit = parseLimit(sp.limit);

  const supabase = await createClient();
  let q = supabase
    .from("audit_log")
    .select(
      "id, caisse_id, action, entite_type, entite_id, acteur_user_id, acteur_membre_id, payload, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (action) q = q.eq("action", action);
  if (from) q = q.gte("created_at", `${from}T00:00:00Z`);
  if (to) q = q.lte("created_at", `${to}T23:59:59Z`);
  const { data: rows } = await q;

  const caisseIds = new Set<string>();
  const userIds = new Set<string>();
  const membreIds = new Set<string>();
  for (const r of rows ?? []) {
    if (r.caisse_id) caisseIds.add(r.caisse_id);
    if (r.acteur_user_id) userIds.add(r.acteur_user_id);
    if (r.acteur_membre_id) membreIds.add(r.acteur_membre_id);
    const p = r.payload as Record<string, unknown>;
    if (typeof p["user_id"] === "string") userIds.add(p["user_id"] as string);
    if (typeof p["membre_id"] === "string") membreIds.add(p["membre_id"] as string);
  }

  const caisseNomById = new Map<string, string>();
  if (caisseIds.size > 0) {
    const { data: cs } = await supabase
      .from("caisses")
      .select("id, nom")
      .in("id", Array.from(caisseIds));
    for (const c of cs ?? []) caisseNomById.set(c.id, c.nom);
  }

  const emailsById = new Map<string, string>();
  if (userIds.size > 0) {
    const admin = createAdminClient();
    const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const u of usersList?.users ?? []) {
      if (u.email) emailsById.set(u.id, u.email);
    }
  }

  const membresById = new Map<string, { prenom: string; nom: string }>();
  if (membreIds.size > 0) {
    const { data: ms } = await supabase
      .from("membres")
      .select("id, prenom, nom")
      .in("id", Array.from(membreIds));
    for (const m of ms ?? []) membresById.set(m.id, { prenom: m.prenom, nom: m.nom });
  }

  const filteredRows = (rows ?? []).filter((r) => {
    if (!acteur) return true;
    const email = r.acteur_user_id ? emailsById.get(r.acteur_user_id) ?? "" : "";
    const membre = r.acteur_membre_id ? membresById.get(r.acteur_membre_id) : null;
    const membreNom = membre ? `${membre.prenom} ${membre.nom}` : "";
    return `${email} ${membreNom}`.toLowerCase().includes(acteur.toLowerCase());
  });

  const truncated = (rows ?? []).length >= limit;
  const buildUrl = (overrides: { limit?: number }) => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (acteur) params.set("acteur", acteur);
    const l = overrides.limit ?? limit;
    if (l !== 50) params.set("limit", String(l));
    return `?${params.toString()}`;
  };

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Audit global
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Toutes les actions enregistrées, toutes caisses confondues.
          </p>
        </header>

        <AuditFilterBar actions={ACTION_OPTIONS} action={action} from={from} to={to} acteur={acteur} />

        {filteredRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            Aucune action ne correspond aux filtres.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {filteredRows.map((r) => {
              const payload = (r.payload as Record<string, unknown>) ?? {};
              const f = formatAuditAction(r.action, payload, membresById, emailsById);
              const acteurStr = r.acteur_user_id
                ? emailsById.get(r.acteur_user_id) ?? r.acteur_user_id.slice(0, 8)
                : r.acteur_membre_id
                  ? `${membresById.get(r.acteur_membre_id)?.prenom ?? "?"} ${membresById.get(r.acteur_membre_id)?.nom ?? ""} (membre)`
                  : "—";
              const caisseNom = r.caisse_id ? caisseNomById.get(r.caisse_id) ?? "—" : "—";

              return (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-32 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDateTime(r.created_at)}
                    </span>
                    <Link
                      href={r.caisse_id ? `/admin/caisses/${r.caisse_id}` : "#"}
                      className="w-32 shrink-0 truncate text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                    >
                      {caisseNom}
                    </Link>
                    <span className="flex-1 text-zinc-800 dark:text-zinc-200">
                      <span className="font-medium">{f.label}</span>
                      {f.kind === "text" && f.detail && (
                        <span className="ml-2 text-zinc-600 dark:text-zinc-400">{f.detail}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {acteurStr}
                    </span>
                  </div>
                  {f.kind === "json" && (
                    <details className="ml-32 mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <summary className="cursor-pointer select-none">payload brut</summary>
                      <pre className="mt-1 overflow-x-auto rounded bg-zinc-50 p-2 dark:bg-zinc-950">
                        {JSON.stringify(f.raw, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {truncated && (
          <div className="flex justify-center">
            <a
              href={buildUrl({ limit: limit + 50 })}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Charger plus
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
