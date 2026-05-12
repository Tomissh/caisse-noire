import Link from "next/link";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { MotifForm } from "../_form";

export default async function NewMotifPage({
  params,
}: {
  params: Promise<{ caisseId: string }>;
}) {
  const { caisseId } = await params;
  await requireCaisseAdmin(caisseId);

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="space-y-1">
          <Link
            href={`/admin/caisses/${caisseId}/motifs`}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Motifs
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Nouveau motif
          </h1>
        </header>
        <MotifForm caisseId={caisseId} mode="create" />
      </div>
    </main>
  );
}
