"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteMotifAction, toggleMotifActifAction } from "./_actions";

export function MotifRowActions({
  motifId,
  caisseId,
  actif,
  canDelete,
  readOnly,
}: {
  motifId: string;
  caisseId: string;
  actif: boolean;
  canDelete: boolean;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onToggle = () => {
    startTransition(async () => {
      const res = await toggleMotifActifAction({ motifId, caisseId, actif: !actif });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(actif ? "Motif désactivé" : "Motif réactivé");
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!confirm("Supprimer définitivement ce motif ? L'historique des amendes garde le libellé copié.")) {
      return;
    }
    startTransition(async () => {
      const res = await deleteMotifAction({ motifId, caisseId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Motif supprimé");
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1">
      {!readOnly && (
        <Link
          href={`/admin/caisses/${caisseId}/motifs/${motifId}/edit`}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Modifier
        </Link>
      )}
      {!readOnly && (
        <button
          type="button"
          onClick={onToggle}
          disabled={pending}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {actif ? "Désactiver" : "Réactiver"}
        </button>
      )}
      {!readOnly && canDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
        >
          Supprimer
        </button>
      )}
    </div>
  );
}
