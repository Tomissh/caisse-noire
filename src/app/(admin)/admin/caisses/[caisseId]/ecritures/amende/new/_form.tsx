"use client";

// Formulaire de saisie d'une amende.
//
//   - Mode : "single" (1 membre) ou "multi" (N membres, même montant).
//   - Motif : sélecteur catalogue + option "Saisie libre".
//       * Motif `montant_variable = false` → libellé + montant pré-remplis
//         et verrouillés.
//       * Motif `montant_variable = true`  → libellé + montant pré-remplis
//         mais éditables.
//       * Saisie libre → libellé + montant vides, à saisir.
//   - Toggle "Saisir une autre amende" : conserve les valeurs du form après
//     succès (utile pendant un événement).

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { declareAmendeAction } from "../../_actions";

const FREE = "__free__" as const;

type MotifOption = {
  id: string;
  libelle: string;
  montantEuros: number;
  montantVariable: boolean;
};

type MembreOption = { id: string; prenom: string; nom: string };

const schema = z
  .object({
    mode: z.enum(["single", "multi"]),
    motifSelection: z.string(), // motifId ou FREE
    libelle: z.string().trim().min(1, "Libellé requis").max(120),
    montantEuros: z.number().int("Euros entiers").positive("> 0").max(10_000),
    membreId: z.string().optional(),
    membreIds: z.array(z.string()).optional(),
    keepOpen: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === "single" && (!val.membreId || val.membreId === "")) {
      ctx.addIssue({
        code: "custom",
        path: ["membreId"],
        message: "Sélectionnez un membre",
      });
    }
    if (val.mode === "multi" && (!val.membreIds || val.membreIds.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["membreIds"],
        message: "Sélectionnez au moins un membre",
      });
    }
  });
type FormValues = z.infer<typeof schema>;

export function AmendeForm({
  caisseId,
  motifs,
  membres,
}: {
  caisseId: string;
  motifs: MotifOption[];
  membres: MembreOption[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: "single",
      motifSelection: FREE,
      libelle: "",
      montantEuros: 5,
      membreId: "",
      membreIds: [],
      keepOpen: false,
    },
  });

  const motifSelection = watch("motifSelection");
  const mode = watch("mode");

  const selectedMotif = useMemo<MotifOption | null>(() => {
    if (motifSelection === FREE) return null;
    return motifs.find((m) => m.id === motifSelection) ?? null;
  }, [motifSelection, motifs]);

  const locked = selectedMotif !== null && !selectedMotif.montantVariable;

  // À chaque changement de motif sélectionné, repropage libellé + montant.
  useEffect(() => {
    if (selectedMotif) {
      setValue("libelle", selectedMotif.libelle, { shouldValidate: false });
      setValue("montantEuros", selectedMotif.montantEuros, { shouldValidate: false });
    } else {
      // Saisie libre : vide les champs
      setValue("libelle", "", { shouldValidate: false });
      setValue("montantEuros", 5, { shouldValidate: false });
    }
  }, [selectedMotif, setValue]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const motifId = values.motifSelection === FREE ? null : values.motifSelection;
    const membreIds =
      values.mode === "single"
        ? values.membreId
          ? [values.membreId]
          : []
        : values.membreIds ?? [];

    const res = await declareAmendeAction({
      caisseId,
      motifId,
      libelle: values.libelle,
      montantEuros: values.montantEuros,
      membreIds,
    });
    if (!res.ok) {
      setServerError(res.error);
      toast.error(res.error);
      return;
    }
    const n = res.count ?? membreIds.length;
    toast.success(n > 1 ? `${n} amendes déclarées` : "Amende déclarée");
    if (values.keepOpen) {
      reset({
        mode: values.mode,
        motifSelection: values.motifSelection,
        libelle: values.libelle,
        montantEuros: values.montantEuros,
        membreId: "",
        membreIds: [],
        keepOpen: true,
      });
      router.refresh();
    } else {
      router.replace(`/admin/caisses/${caisseId}/ecritures`);
      router.refresh();
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      noValidate
    >
      {/* Mode --------------------------------------------------------- */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Destinataires
        </legend>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" value="single" {...register("mode")} className="size-4" />
            <span>Une personne</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" value="multi" {...register("mode")} className="size-4" />
            <span>Plusieurs personnes (même montant)</span>
          </label>
        </div>
      </fieldset>

      {/* Motif -------------------------------------------------------- */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Motif</label>
        <select
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("motifSelection")}
        >
          <option value={FREE}>Saisie libre</option>
          {motifs.map((m) => (
            <option key={m.id} value={m.id}>
              {m.libelle} — {m.montantEuros} € {m.montantVariable ? "(variable)" : "(fixe)"}
            </option>
          ))}
        </select>
        {locked && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Motif à montant fixe — libellé et montant verrouillés.
          </p>
        )}
      </div>

      {/* Libellé + montant ------------------------------------------- */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Libellé</label>
          <input
            readOnly={locked}
            className={`w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 ${
              locked ? "cursor-not-allowed bg-zinc-50 dark:bg-zinc-900" : ""
            }`}
            {...register("libelle")}
          />
          {errors.libelle && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.libelle.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">€</label>
          <input
            type="number"
            step={1}
            min={1}
            readOnly={locked}
            className={`w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 ${
              locked ? "cursor-not-allowed bg-zinc-50 dark:bg-zinc-900" : ""
            }`}
            {...register("montantEuros", { valueAsNumber: true })}
          />
          {errors.montantEuros && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.montantEuros.message}</p>
          )}
        </div>
      </div>

      {/* Membres ------------------------------------------------------ */}
      {mode === "single" ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Membre</label>
          <select
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            {...register("membreId")}
          >
            <option value="">— Choisir —</option>
            {membres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.prenom} {m.nom}
              </option>
            ))}
          </select>
          {errors.membreId && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.membreId.message}</p>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Membres concernés
          </label>
          <div className="max-h-56 overflow-auto rounded-md border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950">
            {membres.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <input
                  type="checkbox"
                  value={m.id}
                  className="size-4 rounded border-zinc-300 dark:border-zinc-700"
                  {...register("membreIds")}
                />
                <span>
                  {m.prenom} {m.nom}
                </span>
              </label>
            ))}
          </div>
          {errors.membreIds && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.membreIds.message}</p>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          className="size-4 rounded border-zinc-300 dark:border-zinc-700"
          {...register("keepOpen")}
        />
        Saisir une autre amende après celle-ci
      </label>

      {serverError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {isSubmitting ? "Enregistrement…" : "Déclarer"}
        </button>
      </div>
    </form>
  );
}
