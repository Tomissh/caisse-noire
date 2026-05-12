"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { storeMembreSession } from "@/lib/auth/membre-context";

const schema = z.object({
  code_caisse: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{6,12}$/u, "Code caisse invalide (6 à 12 caractères)"),
  prenom: z.string().trim().min(1, "Requis").max(60),
  nom: z.string().trim().min(1, "Requis").max(60),
  mot_de_passe: z.string().min(6, "Mot de passe trop court"),
});

type FormValues = z.infer<typeof schema>;

export function MembreLoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code_caisse: "", prenom: "", nom: "", mot_de_passe: "" },
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
      const res = await fetch(`${url}/functions/v1/login-membre`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          code_caisse: values.code_caisse.toUpperCase(),
          prenom: values.prenom,
          nom: values.nom,
          mot_de_passe: values.mot_de_passe,
        }),
      });

      const body = (await res.json()) as
        | { access_token: string; expires_in: number; caisse_id: string; membre_id: string }
        | { error: string };

      if (!res.ok || !("access_token" in body)) {
        const message = "error" in body ? body.error : "Connexion impossible";
        setServerError(message);
        toast.error(message);
        return;
      }

      storeMembreSession(body.access_token);
      toast.success("Connexion réussie");
      router.replace("/membre");
      router.refresh();
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
        <label htmlFor="code_caisse" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Code caisse
        </label>
        <input
          id="code_caisse"
          autoComplete="off"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm uppercase tracking-wider text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("code_caisse")}
        />
        {errors.code_caisse && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.code_caisse.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="prenom" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Prénom
          </label>
          <input
            id="prenom"
            autoComplete="given-name"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            {...register("prenom")}
          />
          {errors.prenom && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.prenom.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="nom" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Nom
          </label>
          <input
            id="nom"
            autoComplete="family-name"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            {...register("nom")}
          />
          {errors.nom && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.nom.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="mot_de_passe" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Mot de passe
        </label>
        <input
          id="mot_de_passe"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("mot_de_passe")}
        />
        {errors.mot_de_passe && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.mot_de_passe.message}</p>
        )}
      </div>

      {serverError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {isSubmitting ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
