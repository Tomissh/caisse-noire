// Page audit log d'une caisse.
// Filtres via URL params : action, from, to, acteur. Pagination via limit.

import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTION_OPTIONS, formatAuditAction } from "./_format";
import { AuditFilterBar } from "./_components/filter-bar";

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

const ACTION_ICON: Record<string, string> = {
  "amende.create": "🔴",
  "amende.delete": "↩",
  "paiement.create": "🟢",
  "paiement.delete": "↩",
  "retrait.create": "🟠",
  "caisse.create": "📦",
  "caisse.update": "✎",
  "caisse.cloture": "🔒",
  "caisse.reouverture": "🔓",
  "caisse.delete": "✕",
  "membre.create": "👤",
  "membre.update": "✎",
  "membre.set_password": "🔑",
  "membre.delete": "✕",
  "motif.create": "📋",
  "motif.update": "✎",
  "motif.deactivate": "○",
  "motif.reactivate": "●",
  "motif.delete": "✕",
  "admin.add": "⚙",
  "admin.remove": "⚙",
};

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ caisseId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { caisseId } = await params;
  const sp = await searchParams;
  await requireCaisseAdmin(caisseId);

  const actionFilter = parseStr(sp.action);
  const from = parseStr(sp.from);
  const to = parseStr(sp.to);
  const acteurFilter = parseStr(sp.acteur);
  const limit = parseLimit(sp.limit);

  const supabase = await createClient();

  let q = supabase
    .from("audit_log")
    .select(
      "id, caisse_id, action, entite_type, entite_id, acteur_user_id, acteur_membre_id, payload, created_at",
    )
    .eq("caisse_id", caisseId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (actionFilter) q = q.eq("action", actionFilter);
  if (from) q = q.gte("created_at", `${from}T00:00:00Z`);
  if (to) q = q.lte("created_at", `${to}T23:59:59Z`);

  const { data: rows, error } = await q;

  // Résolution emails des acteurs + filtrage par acteur côté JS si demandé.
  const userIds = new Set<string>();
  const membreIds = new Set<string>();
  for (const r of rows ?? []) {
    if (r.acteur_user_id) userIds.add(r.acteur_user_id);
    if (r.acteur_membre_id) membreIds.add(r.acteur_membre_id);
    // Aussi récupérer user_ids depuis payload pour admin.add / admin.remove
    const p = r.payload as Record<string, unknown>;
    const pid = p["user_id"];
    if (typeof pid === "string") userIds.add(pid);
    const mpid = p["membre_id"];
    if (typeof mpid === "string") membreIds.add(mpid);
  }

  const emailsById = new Map<string, string>();
  if (userIds.size > 0) {
    const admin = createAdminClient();
    const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const u of usersList?.users ?? []) {
      if (u.email) emailsById.set(u.id, u.email);
    }
  }

  // Membres pour rendu humain
  const membresById = new Map<string, { prenom: string; nom: string }>();
  if (membreIds.size > 0) {
    const { data: ms } = await supabase
      .from("membres")
      .select("id, prenom, nom")
      .in("id", Array.from(membreIds));
    for (const m of ms ?? []) {
      membresById.set(m.id, { prenom: m.prenom, nom: m.nom });
    }
  }

  const filteredRows = (rows ?? []).filter((r) => {
    if (!acteurFilter) return true;
    const email = r.acteur_user_id ? emailsById.get(r.acteur_user_id) ?? "" : "";
    const membre = r.acteur_membre_id ? membresById.get(r.acteur_membre_id) : null;
    const membreNom = membre ? `${membre.prenom} ${membre.nom}` : "";
    const haystack = `${email} ${membreNom}`.toLowerCase();
    return haystack.includes(acteurFilter.toLowerCase());
  });

  // URL builder pour "charger plus"
  const buildUrl = (overrides: { limit?: number }) => {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (acteurFilter) params.set("acteur", acteurFilter);
    const l = overrides.limit ?? limit;
    if (l !== 50) params.set("limit", String(l));
    return `?${params.toString()}`;
  };

  const truncated = (rows ?? []).length >= limit;

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Audit log
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Toutes les actions enregistrées sur cette caisse.
          </p>
        </header>

        <AuditFilterBar
          actions={ACTION_OPTIONS}
          action={actionFilter}
          from={from}
          to={to}
          acteur={acteurFilter}
        />

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error.message}
          </p>
        )}

        {filteredRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            Aucune action ne correspond aux filtres.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {filteredRows.map((r) => {
              const payload = (r.payload as Record<string, unknown>) ?? {};
              const formatted = formatAuditAction(r.action, payload, membresById, emailsById);
              const acteurEmail = r.acteur_user_id
                ? emailsById.get(r.acteur_user_id) ?? r.acteur_user_id.slice(0, 8)
                : null;
              const acteurMembre = r.acteur_membre_id
                ? membresById.get(r.acteur_membre_id)
                : null;
              const acteurStr =
                acteurEmail ??
                (acteurMembre ? `${acteurMembre.prenom} ${acteurMembre.nom} (membre)` : "—");

              return (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-center text-base">
                      {ACTION_ICON[r.action] ?? "•"}
                    </span>
                    <span className="w-32 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDateTime(r.created_at)}
                    </span>
                    <span className="flex-1 text-zinc-800 dark:text-zinc-200">
                      <span className="font-medium">{formatted.label}</span>
                      {formatted.kind === "text" && formatted.detail && (
                        <span className="ml-2 text-zinc-600 dark:text-zinc-400">
                          {formatted.detail}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {acteurStr}
                    </span>
                  </div>
                  {formatted.kind === "json" && (
                    <details className="ml-9 mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <summary className="cursor-pointer select-none">payload brut</summary>
                      <pre className="mt-1 overflow-x-auto rounded bg-zinc-50 p-2 dark:bg-zinc-950">
                        {JSON.stringify(formatted.raw, null, 2)}
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
