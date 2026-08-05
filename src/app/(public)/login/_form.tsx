"use client";

// Connexion admin : accepte soit l'email, soit le nom d'utilisateur choisi
// à la création du compte (resolve_username_email). Les comptes créés
// avant l'ajout du username (ex. le tout premier créateur, provisionné
// manuellement) n'ont pas de username — ils se connectent avec leur email,
// détecté via la présence d'un "@".
//
// Message d'erreur volontairement générique dans tous les cas (identifiant
// inconnu, username sans compte, mauvais mot de passe) pour ne pas
// faciliter l'énumération des comptes.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  identifiant: z.string().trim().min(1, "Champ requis"),
  password: z.string().min(6, "Mot de passe trop court"),
});

type FormValues = z.infer<typeof schema>;

const GENERIC_ERROR = "Identifiants invalides";

export function AdminLoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifiant: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const supabase = createClient();

    let email = values.identifiant;
    if (!email.includes("@")) {
      const { data, error: rpcError } = await supabase.rpc("resolve_username_email", {
        p_username: values.identifiant,
      });
      if (rpcError || !data) {
        setServerError(GENERIC_ERROR);
        toast.error("Connexion impossible");
        return;
      }
      email = data;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: values.password });
    if (error) {
      setServerError(GENERIC_ERROR);
      toast.error("Connexion impossible");
      return;
    }
    toast.success("Connexion réussie");
    router.replace("/admin");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      noValidate
    >
      <div className="space-y-1">
        <label
          htmlFor="identifiant"
          className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Identifiant
        </label>
        <input
          id="identifiant"
          type="text"
          autoComplete="username"
          placeholder="Nom d'utilisateur ou email"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("identifiant")}
        />
        {errors.identifiant && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.identifiant.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>
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
