"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordPaiementAction } from "../../_actions";

// Moyen de paiement : toujours espèces (pas d'autre moyen accepté par la
// caisse), donc pas de choix à faire à la saisie.
const MOYEN = "especes" as const;

const schema = z.object({
  membreId: z.uuid("Sélectionnez un membre"),
  montantEuros: z.number().int("Euros entiers").positive("> 0").max(10_000),
});
type FormValues = z.infer<typeof schema>;

export function PaiementForm({
  caisseId,
  membres,
  onSuccess,
  onCancel,
}: {
  caisseId: string;
  membres: { id: string; nom: string }[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { membreId: "", montantEuros: 10 },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res = await recordPaiementAction({ caisseId, ...values, moyen: MOYEN });
    if (!res.ok) {
      setServerError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Paiement enregistré");
    if (onSuccess) {
      onSuccess();
    } else {
      router.replace(`/admin/caisses/${caisseId}/ecritures`);
    }
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      noValidate
    >
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Membre</label>
        <select
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("membreId")}
        >
          <option value="">— Choisir —</option>
          {membres.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
        {errors.membreId && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.membreId.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Montant (euros)
        </label>
        <input
          type="number"
          step={1}
          min={1}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("montantEuros", { valueAsNumber: true })}
        />
        {errors.montantEuros && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.montantEuros.message}</p>
        )}
      </div>

      {serverError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => (onCancel ? onCancel() : router.back())}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {isSubmitting ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
