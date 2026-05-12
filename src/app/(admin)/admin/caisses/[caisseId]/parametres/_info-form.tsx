"use client";

// Bloc édition info caisse (nom, description) + régénération du code.

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { regenerateCodeAction, updateCaisseAction } from "./_actions";

const schema = z.object({
  nom: z.string().trim().min(1, "Requis").max(80),
  description: z.string().trim().max(500).optional(),
});
type FormValues = z.infer<typeof schema>;

export function CaisseInfoForm({
  caisseId,
  nom,
  description,
  code,
}: {
  caisseId: string;
  nom: string;
  description: string;
  code: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nom, description },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res = await updateCaisseAction({ caisseId, ...values });
    if (!res.ok) {
      setServerError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Caisse mise à jour");
    router.refresh();
  };

  const onRegenerate = () => {
    if (!confirm("Régénérer le code d'accès ? L'ancien ne fonctionnera plus pour les futures connexions.")) {
      return;
    }
    startTransition(async () => {
      const res = await regenerateCodeAction({ caisseId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Nouveau code : ${res.code}`);
      router.refresh();
    });
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copié");
    } catch {
      toast.error("Copie impossible");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      noValidate
    >
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Informations</h2>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Nom</label>
        <input
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("nom")}
        />
        {errors.nom && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.nom.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <textarea
          rows={3}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("description")}
        />
        {errors.description && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Code d&apos;accès
        </label>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
            {code}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Copier
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={pending}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {pending ? "…" : "Régénérer"}
          </button>
        </div>
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
