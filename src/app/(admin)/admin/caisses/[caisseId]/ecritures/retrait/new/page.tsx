import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { RetraitForm } from "./_form";

export default async function NewRetraitPage({
  params,
}: {
  params: Promise<{ caisseId: string }>;
}) {
  const { caisseId } = await params;
  const ctx = await requireCaisseAdmin(caisseId);
  if (ctx.caisse.cloturee_at) {
    redirect(`/admin/caisses/${caisseId}/ecritures`);
  }

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
            Nouveau retrait
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sortie d&apos;argent de la caisse. Une fois enregistré, le retrait est
            immuable — une correction se fait en saisissant un nouveau retrait avec un
            montant négatif.
          </p>
        </header>
        <RetraitForm caisseId={caisseId} />
      </div>
    </main>
  );
}
