"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reouvrirCaisseFromSuperAction } from "../_actions";

export function ReouvrirButton({
  caisseId,
  caisseNom,
}: {
  caisseId: string;
  caisseNom: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm(`Réouvrir la caisse « ${caisseNom} » ?`)) return;
    startTransition(async () => {
      const res = await reouvrirCaisseFromSuperAction({ caisseId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Caisse réouverte");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
    >
      {pending ? "…" : "Réouvrir"}
    </button>
  );
}
