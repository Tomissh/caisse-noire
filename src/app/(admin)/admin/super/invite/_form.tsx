"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createAdminUserAction } from "../_actions";
import { generatePassword } from "@/lib/caisse-code";

const schema = z.object({
  email: z.email("Email invalide"),
  password: z.string().min(8, "≥ 8 caractères").max(200),
  makeSuperAdmin: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function InviteForm() {
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", makeSuperAdmin: false },
  });

  const onGenerate = () => {
    setValue("password", generatePassword(16), { shouldValidate: true });
  };

  const onSubmit = async (v: Values) => {
    setServerError(null);
    const res = await createAdminUserAction(v);
    if (!res.ok) {
      setServerError(res.error);
      toast.error(res.error);
      return;
    }
    setCreated({ email: v.email, password: res.password });
    toast.success("Compte créé");
    reset({ email: "", password: "", makeSuperAdmin: false });
  };

  if (created) {
    return (
      <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
          Compte créé ✓
        </h2>
        <p className="text-xs text-emerald-800 dark:text-emerald-300">
          Notez ces identifiants — le mot de passe n&apos;apparaîtra plus.
        </p>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Email</dt>
            <dd className="font-mono text-zinc-900 dark:text-zinc-50">{created.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
              Mot de passe
            </dt>
            <dd className="font-mono text-zinc-900 dark:text-zinc-50">{created.password}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => setCreated(null)}
          className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
        >
          Créer un autre compte
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      noValidate
    >
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Email</label>
        <input
          type="email"
          autoComplete="off"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Mot de passe (≥ 8 caractères)
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
          type="text"
          autoComplete="off"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          className="size-4 rounded border-zinc-300 dark:border-zinc-700"
          {...register("makeSuperAdmin")}
        />
        Donner aussi le rôle super-administrateur
      </label>

      {serverError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {serverError}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {isSubmitting ? "Création…" : "Créer le compte"}
        </button>
      </div>
    </form>
  );
}
