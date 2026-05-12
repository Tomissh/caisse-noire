"use client";

// Formulaire de changement de mot de passe membre.
// Appelle directement l'Edge Function set-password-membre avec le JWT custom
// en Authorization: Bearer. La fonction valide l'ancien mot de passe avant
// de hasher et stocker le nouveau.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMembreAuth } from "@/lib/auth/membre-context";

const schema = z
  .object({
    ancien: z.string().min(1, "Requis"),
    nouveau: z.string().min(6, "≥ 6 caractères").max(100),
    confirmation: z.string(),
  })
  .superRefine((val, ctx) => {
    if (val.nouveau !== val.confirmation) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "La confirmation ne correspond pas",
      });
    }
    if (val.nouveau === val.ancien) {
      ctx.addIssue({
        code: "custom",
        path: ["nouveau"],
        message: "Le nouveau mot de passe doit être différent de l'ancien",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const router = useRouter();
  const { accessToken, claims } = useMembreAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ancien: "", nouveau: "", confirmation: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      setServerError("Configuration manquante");
      return;
    }

    try {
      const res = await fetch(`${url}/functions/v1/set-password-membre`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          membre_id: claims.membre_id,
          nouveau_mot_de_passe: values.nouveau,
          ancien_mot_de_passe: values.ancien,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        const message = body.error ?? "Échec du changement de mot de passe";
        setServerError(message);
        toast.error(message);
        return;
      }
      toast.success("Mot de passe modifié");
      router.replace("/membre");
    } catch {
      const message = "Impossible de joindre le serveur";
      setServerError(message);
      toast.error(message);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      noValidate
    >
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Mot de passe actuel
        </label>
        <input
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("ancien")}
        />
        {errors.ancien && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.ancien.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Nouveau mot de passe
        </label>
        <input
          type="password"
          autoComplete="new-password"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("nouveau")}
        />
        {errors.nouveau && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.nouveau.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Confirmation
        </label>
        <input
          type="password"
          autoComplete="new-password"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("confirmation")}
        />
        {errors.confirmation && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.confirmation.message}</p>
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
          {isSubmitting ? "Mise à jour…" : "Changer le mot de passe"}
        </button>
      </div>
    </form>
  );
}
