import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { createClient } from "@/lib/supabase/server";
import { PaiementForm } from "./_form";

export default async function NewPaiementPage({
  params,
}: {
  params: Promise<{ caisseId: string }>;
}) {
  const { caisseId } = await params;
  const ctx = await requireCaisseAdmin(caisseId);
  if (ctx.caisse.cloturee_at) {
    redirect(`/admin/caisses/${caisseId}/ecritures`);
  }

  const supabase = await createClient();
  const { data: membres } = await supabase
    .from("membres")
    .select("id, nom")
    .eq("caisse_id", caisseId)
    .eq("actif", true)
    .order("nom");

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="space-y-1">
          <Link
            href={`/admin/caisses/${caisseId}/ecritures`}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Écritures
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Nouveau paiement
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Le paiement est crédité au compte-courant du membre. Il peut être supérieur à sa
            dette : l&apos;excédent reste en avance.
          </p>
        </header>
        <PaiementForm caisseId={caisseId} membres={membres ?? []} />
      </div>
    </main>
  );
}
