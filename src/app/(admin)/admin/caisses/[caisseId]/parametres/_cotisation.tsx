"use client";

// Bloc édition de la cotisation mensuelle obligatoire.
//
// Pas une amende (rien à déclarer) : montant automatique appliqué chaque
// mois à tout membre actif, calculé par situation_caisse_mois.
//   - "Plafonner par les amendes" : si activé, la cotisation devient un
//     plancher (max(amendes_du_mois, cotisation)) au lieu de s'ajouter aux
//     amendes systématiquement.
//   - "Prendre en compte le solde" (n'a d'effet que si le plafond est actif)
//     : le plancher n'est appliqué que si le membre termine le mois en
//     négatif (solde reporté + amendes du mois), sinon la cotisation n'est
//     pas due.

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateCotisationAction } from "./_actions";

const schema = z.object({
  active: z.boolean(),
  montantEuros: z.number().int().min(0).max(1_000),
  plafonneeParAmendes: z.boolean(),
  soldePrisEnCompte: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function CotisationForm({
  caisseId,
  active,
  montantEuros,
  plafonneeParAmendes,
  soldePrisEnCompte,
}: {
  caisseId: string;
  active: boolean;
  montantEuros: number;
  plafonneeParAmendes: boolean;
  soldePrisEnCompte: boolean;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      active,
      montantEuros: montantEuros || 5,
      plafonneeParAmendes,
      soldePrisEnCompte,
    },
  });

  const isActive = useWatch({ control, name: "active" });
  const isPlafonnee = useWatch({ control, name: "plafonneeParAmendes" });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res = await updateCotisationAction({ caisseId, ...values });
    if (!res.ok) {
      setServerError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Cotisation mise à jour");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      noValidate
    >
      <div>
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Cotisation mensuelle
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Montant automatique dû chaque mois par tout membre actif — pas besoin de le
          déclarer comme une amende.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          className="size-4 rounded border-zinc-300 dark:border-zinc-700"
          {...register("active")}
        />
        Cotisation obligatoire activée
      </label>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Montant (euros)
        </label>
        <input
          type="number"
          step={1}
          min={0}
          disabled={!isActive}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:disabled:bg-zinc-900"
          {...register("montantEuros", { valueAsNumber: true })}
        />
        {errors.montantEuros && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.montantEuros.message}</p>
        )}
      </div>

      <div className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <label
          className={`flex items-start gap-2 text-sm ${
            isActive ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"
          }`}
        >
          <input
            type="checkbox"
            disabled={!isActive}
            className="mt-0.5 size-4 rounded border-zinc-300 disabled:cursor-not-allowed dark:border-zinc-700"
            {...register("plafonneeParAmendes")}
          />
          <span>
            Plafonner par les amendes
            <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
              Si les amendes du mois dépassent la cotisation, seules les amendes sont dues.
              Sinon, le membre paie au minimum la cotisation.
            </span>
          </span>
        </label>

        <label
          className={`flex items-start gap-2 text-sm ${
            isActive && isPlafonnee
              ? "text-zinc-700 dark:text-zinc-300"
              : "text-zinc-400 dark:text-zinc-600"
          }`}
        >
          <input
            type="checkbox"
            disabled={!isActive || !isPlafonnee}
            className="mt-0.5 size-4 rounded border-zinc-300 disabled:cursor-not-allowed dark:border-zinc-700"
            {...register("soldePrisEnCompte")}
          />
          <span>
            Prendre en compte le solde
            <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
              La cotisation minimum n&apos;est due que si le solde reporté + les amendes du
              mois font passer le membre en négatif. S&apos;il reste à l&apos;avance, pas de
              cotisation.
            </span>
          </span>
        </label>
      </div>

      {serverError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {serverError}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {isSubmitting ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
