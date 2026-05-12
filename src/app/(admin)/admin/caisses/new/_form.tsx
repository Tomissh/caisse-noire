"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCaisseAction } from "../../_actions";

const schema = z.object({
  nom: z.string().trim().min(1, "Requis").max(80),
  description: z.string().trim().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

export function CreateCaisseForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nom: "", description: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res = await createCaisseAction(values);
    if (!res.ok) {
      setServerError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(`Caisse créée — code ${res.code}`);
    router.replace(`/admin/caisses/${res.caisseId}`);
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      noValidate
    >
      <div className="space-y-1">
        <label htmlFor="nom" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Nom de la caisse
        </label>
        <input
          id="nom"
          autoFocus
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          placeholder="Ex. Équipe Sénior 2026"
          {...register("nom")}
        />
        {errors.nom && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.nom.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="description"
          className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Description (facultatif)
        </label>
        <textarea
          id="description"
          rows={3}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("description")}
        />
        {errors.description && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.description.message}</p>
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
          {isSubmitting ? "Création…" : "Créer la caisse"}
        </button>
      </div>
    </form>
  );
}
