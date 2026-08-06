"use client";

// Formulaire de saisie d'amendes — plusieurs lignes en une fois.
//
//   - Chaque ligne = 1 amende (membre + motif + libellé + montant).
//   - "+ Ajouter une amende" empile une nouvelle ligne vide en dessous,
//     sans rien enregistrer — tout est validé ensemble à la fin, en un
//     seul aller-retour serveur (declareAmendesBatchAction).
//   - Par ligne, membre au-dessus du motif.
//   - Motif : sélecteur catalogue + option "Saisie libre".
//       * Motif `montant_variable = false` → libellé + montant pré-remplis
//         et verrouillés.
//       * Motif `montant_variable = true`  → libellé + montant pré-remplis
//         mais éditables.
//       * Saisie libre → libellé + montant vides, à saisir.

import { useEffect, useMemo } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { declareAmendesBatchAction } from "../../_actions";

const FREE = "__free__" as const;

type MotifOption = {
  id: string;
  libelle: string;
  montantEuros: number;
  montantVariable: boolean;
};

type MembreOption = { id: string; nom: string };

const rowSchema = z.object({
  membreId: z.string().min(1, "Sélectionnez un membre"),
  motifSelection: z.string(), // motifId ou FREE
  libelle: z.string().trim().min(1, "Libellé requis").max(120),
  montantEuros: z.number().int("Euros entiers").positive("> 0").max(10_000),
  jourMatch: z.boolean(),
});

const schema = z.object({
  rows: z.array(rowSchema).min(1),
});
type FormValues = z.infer<typeof schema>;

function emptyRow(): FormValues["rows"][number] {
  return { membreId: "", motifSelection: FREE, libelle: "", montantEuros: 5, jourMatch: false };
}

export function AmendeForm({
  caisseId,
  motifs,
  membres,
  onSuccess,
  onCancel,
}: {
  caisseId: string;
  motifs: MotifOption[];
  membres: MembreOption[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rows: [emptyRow()] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "rows" });

  const onSubmit = async (values: FormValues) => {
    const rows = values.rows.map((r) => ({
      motifId: r.motifSelection === FREE ? null : r.motifSelection,
      libelle: r.libelle,
      montantEuros: r.montantEuros,
      membreId: r.membreId,
      jourMatch: r.jourMatch,
    }));

    const res = await declareAmendesBatchAction({ caisseId, rows });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const n = res.count ?? rows.length;
    toast.success(n > 1 ? `${n} amendes déclarées` : "Amende déclarée");
    if (onSuccess) {
      onSuccess();
    } else {
      router.replace(`/admin/caisses/${caisseId}/ecritures`);
    }
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-4">
        {fields.map((field, index) => (
          <AmendeRowFields
            key={field.id}
            index={index}
            control={control}
            register={register}
            setValue={setValue}
            motifs={motifs}
            membres={membres}
            errors={errors.rows?.[index]}
            onRemove={() => remove(index)}
            canRemove={fields.length > 1}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => append(emptyRow())}
        className="w-full rounded-md border border-dashed border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
      >
        + Ajouter une amende
      </button>

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
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {isSubmitting
            ? "Enregistrement…"
            : fields.length > 1
              ? `Déclarer les ${fields.length} amendes`
              : "Déclarer"}
        </button>
      </div>
    </form>
  );
}

function AmendeRowFields({
  index,
  control,
  register,
  setValue,
  motifs,
  membres,
  errors,
  onRemove,
  canRemove,
}: {
  index: number;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  motifs: MotifOption[];
  membres: MembreOption[];
  errors?: {
    membreId?: { message?: string };
    motifSelection?: { message?: string };
    libelle?: { message?: string };
    montantEuros?: { message?: string };
  };
  onRemove: () => void;
  canRemove: boolean;
}) {
  const motifSelection = useWatch({ control, name: `rows.${index}.motifSelection` });
  const montantEuros = useWatch({ control, name: `rows.${index}.montantEuros` });
  const jourMatch = useWatch({ control, name: `rows.${index}.jourMatch` });

  const selectedMotif = useMemo<MotifOption | null>(() => {
    if (motifSelection === FREE) return null;
    return motifs.find((m) => m.id === motifSelection) ?? null;
  }, [motifSelection, motifs]);

  const locked = selectedMotif !== null && !selectedMotif.montantVariable;

  // À chaque changement de motif sélectionné sur cette ligne, repropage
  // libellé + montant.
  useEffect(() => {
    if (selectedMotif) {
      setValue(`rows.${index}.libelle`, selectedMotif.libelle, { shouldValidate: false });
      setValue(`rows.${index}.montantEuros`, selectedMotif.montantEuros, { shouldValidate: false });
    } else {
      setValue(`rows.${index}.libelle`, "", { shouldValidate: false });
      setValue(`rows.${index}.montantEuros`, 5, { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMotif, index]);

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Amende {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-600 underline-offset-2 hover:underline dark:text-red-400"
          >
            Retirer
          </button>
        )}
      </div>

      {/* Membre -------------------------------------------------------- */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Membre</label>
        <select
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register(`rows.${index}.membreId`)}
        >
          <option value="">— Choisir —</option>
          {membres.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
        {errors?.membreId && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.membreId.message}</p>
        )}
      </div>

      {/* Motif -------------------------------------------------------- */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Motif</label>
        <select
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register(`rows.${index}.motifSelection`)}
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
            {...register(`rows.${index}.libelle`)}
          />
          {errors?.libelle && (
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
            {...register(`rows.${index}.montantEuros`, { valueAsNumber: true })}
          />
          {errors?.montantEuros && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.montantEuros.message}</p>
          )}
        </div>
      </div>

      {/* Jour de match --------------------------------------------------- */}
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            className="size-4"
            {...register(`rows.${index}.jourMatch`)}
          />
          <span className="text-zinc-700 dark:text-zinc-300">
            Jour de match (montant ×2)
          </span>
        </label>
        {jourMatch && Number.isFinite(montantEuros) && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Montant final : {montantEuros * 2} €
          </p>
        )}
      </div>
    </div>
  );
}
