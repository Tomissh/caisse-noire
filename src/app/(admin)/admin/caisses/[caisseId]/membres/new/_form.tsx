"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMembreAction } from "../_actions";
import { generatePassword } from "@/lib/caisse-code";

const schema = z.object({
  nom: z.string().trim().min(1, "Requis").max(60),
  password: z.string().min(6, "≥ 6 caractères").max(100),
});

type FormValues = z.infer<typeof schema>;

export function NewMembreForm({ caisseId }: { caisseId: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nom: "", password: "" },
  });

  const onGenerate = () => {
    setValue("password", generatePassword(14), { shouldValidate: true });
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res = await createMembreAction({ caisseId, ...values });
    if (!res.ok) {
      setServerError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Membre créé");
    router.replace(`/admin/caisses/${caisseId}/membres`);
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
          Nom
        </label>
        <input
          id="nom"
          autoComplete="off"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("nom")}
        />
        {errors.nom && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.nom.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            Mot de passe initial
          </label>
          <button
            type="button"
            onClick={onGenerate}
            className="text-xs text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Générer
          </button>
        </div>
        <input
          id="password"
          type="text"
          autoComplete="off"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>
        )}
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Visible en clair pour que vous puissiez le copier et le transmettre au membre.
        </p>
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
          {isSubmitting ? "Création…" : "Créer le membre"}
        </button>
      </div>
    </form>
  );
}
