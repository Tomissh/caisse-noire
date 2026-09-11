"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordPaiementAction } from "../../_actions";

// Moyen de paiement : toujours espèces (pas d'autre moyen accepté par la
// caisse), donc pas de choix à faire à la saisie.
const MOYEN = "especes" as const;

// Pénalité de retard : 2€ par jour, calculée en base par
// tg_paiements_appliquer_retard (migration 20260911090000) — l'aperçu
// affiché ici est indicatif, le frontend ne calcule rien qui parte au
// serveur (CDC 8.1 #1).
const PENALITE_RETARD_EUROS_PAR_JOUR = 2;

const schema = z
  .object({
    membreId: z.uuid("Sélectionnez un membre"),
    montantEuros: z.number().int("Euros entiers").positive("> 0").max(10_000),
    retard: z.boolean(),
    joursRetard: z.number().int("Jours entiers").min(0).max(365),
  })
  .refine((v) => !v.retard || v.joursRetard >= 1, {
    message: "Indiquez au moins 1 jour de retard",
    path: ["joursRetard"],
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
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { membreId: "", montantEuros: 10, retard: false, joursRetard: 1 },
  });

  const retard = useWatch({ control, name: "retard" });
  const joursRetard = useWatch({ control, name: "joursRetard" });
  const montantEuros = useWatch({ control, name: "montantEuros" });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res = await recordPaiementAction({
      caisseId,
      ...values,
      joursRetard: values.retard ? values.joursRetard : 0,
      moyen: MOYEN,
    });
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

      {/* Retard --------------------------------------------------------- */}
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" className="size-4" {...register("retard")} />
          <span className="text-zinc-700 dark:text-zinc-300">
            Paiement en retard (+{PENALITE_RETARD_EUROS_PAR_JOUR} € / jour)
          </span>
        </label>
        {retard && (
          <div className="space-y-1 pt-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Nombre de jours de retard
            </label>
            <input
              type="number"
              step={1}
              min={1}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              {...register("joursRetard", { valueAsNumber: true })}
            />
            {errors.joursRetard && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.joursRetard.message}</p>
            )}
            {Number.isFinite(joursRetard) && joursRetard >= 1 && Number.isFinite(montantEuros) && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Pénalité : {joursRetard * PENALITE_RETARD_EUROS_PAR_JOUR} € ({joursRetard} j ×{" "}
                {PENALITE_RETARD_EUROS_PAR_JOUR} €) — Montant total :{" "}
                {montantEuros + joursRetard * PENALITE_RETARD_EUROS_PAR_JOUR} €
              </p>
            )}
          </div>
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
