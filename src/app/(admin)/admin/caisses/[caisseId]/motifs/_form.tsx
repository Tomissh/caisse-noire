"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMotifAction, updateMotifAction } from "./_actions";

const schema = z.object({
  libelle: z.string().trim().min(1, "Requis").max(120),
  montantEuros: z.number().int("Euros entiers uniquement").positive("> 0").max(10_000),
  montantVariable: z.boolean(),
  actif: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

type Props =
  | { caisseId: string; mode: "create" }
  | {
      caisseId: string;
      mode: "edit";
      initial: {
        motifId: string;
        libelle: string;
        montantEuros: number;
        montantVariable: boolean;
        actif: boolean;
      };
    };

export function MotifForm(props: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: FormValues =
    props.mode === "edit"
      ? {
          libelle: props.initial.libelle,
          montantEuros: props.initial.montantEuros,
          montantVariable: props.initial.montantVariable,
          actif: props.initial.actif,
        }
      : { libelle: "", montantEuros: 5, montantVariable: false, actif: true };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res =
      props.mode === "create"
        ? await createMotifAction({
            caisseId: props.caisseId,
            libelle: values.libelle,
            montantEuros: values.montantEuros,
            montantVariable: values.montantVariable,
          })
        : await updateMotifAction({
            motifId: props.initial.motifId,
            caisseId: props.caisseId,
            libelle: values.libelle,
            montantEuros: values.montantEuros,
            montantVariable: values.montantVariable,
            actif: values.actif,
          });
    if (!res.ok) {
      setServerError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(props.mode === "create" ? "Motif créé" : "Motif mis à jour");
    router.replace(`/admin/caisses/${props.caisseId}/motifs`);
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      noValidate
    >
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Libellé</label>
        <input
          autoFocus
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          placeholder="Ex. Retard à l'entraînement"
          {...register("libelle")}
        />
        {errors.libelle && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.libelle.message}</p>
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

      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          className="mt-1 size-4 rounded border-zinc-300 dark:border-zinc-700"
          {...register("montantVariable")}
        />
        <span>
          <strong>Montant variable</strong>
          <br />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Si coché, le libellé et le montant pourront être modifiés à la saisie d&apos;une amende.
            Sinon, ils seront pré-remplis et verrouillés.
          </span>
        </span>
      </label>

      {props.mode === "edit" && (
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            className="size-4 rounded border-zinc-300 dark:border-zinc-700"
            {...register("actif")}
          />
          Motif actif
        </label>
      )}

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
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {isSubmitting ? "Enregistrement…" : props.mode === "create" ? "Créer" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
