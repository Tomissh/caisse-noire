"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateMembreAction, resetMembrePasswordAction } from "../../_actions";
import { generatePassword } from "@/lib/caisse-code";

const infoSchema = z.object({
  nom: z.string().trim().min(1, "Requis").max(60),
  actif: z.boolean(),
});
type InfoValues = z.infer<typeof infoSchema>;

const pwdSchema = z.object({
  password: z.string().min(6, "≥ 6 caractères").max(100),
});
type PwdValues = z.infer<typeof pwdSchema>;

export function EditMembreForm({
  caisseId,
  membre,
}: {
  caisseId: string;
  membre: { id: string; nom: string; actif: boolean };
}) {
  const router = useRouter();

  // --- Form info -----------------------------------------------------------
  const [infoError, setInfoError] = useState<string | null>(null);
  const infoForm = useForm<InfoValues>({
    resolver: zodResolver(infoSchema),
    defaultValues: { nom: membre.nom, actif: membre.actif },
  });

  const onSubmitInfo = async (values: InfoValues) => {
    setInfoError(null);
    const res = await updateMembreAction({
      membreId: membre.id,
      caisseId,
      ...values,
    });
    if (!res.ok) {
      setInfoError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Membre mis à jour");
    router.refresh();
  };

  // --- Form password -------------------------------------------------------
  const [pwdError, setPwdError] = useState<string | null>(null);
  const pwdForm = useForm<PwdValues>({
    resolver: zodResolver(pwdSchema),
    defaultValues: { password: "" },
  });

  const onGenerate = () => {
    pwdForm.setValue("password", generatePassword(14), { shouldValidate: true });
  };

  const onSubmitPwd = async (values: PwdValues) => {
    setPwdError(null);
    const res = await resetMembrePasswordAction({
      membreId: membre.id,
      caisseId,
      password: values.password,
    });
    if (!res.ok) {
      setPwdError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Mot de passe réinitialisé");
    pwdForm.reset({ password: "" });
  };

  return (
    <div className="space-y-6">
      {/* Bloc info ------------------------------------------------------- */}
      <form
        onSubmit={infoForm.handleSubmit(onSubmitInfo)}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        noValidate
      >
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Informations</h2>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Nom</label>
          <input
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            {...infoForm.register("nom")}
          />
          {infoForm.formState.errors.nom && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {infoForm.formState.errors.nom.message}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            className="size-4 rounded border-zinc-300 dark:border-zinc-700"
            {...infoForm.register("actif")}
          />
          Membre actif
        </label>

        {infoError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {infoError}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={infoForm.formState.isSubmitting}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {infoForm.formState.isSubmitting ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>

      {/* Bloc password --------------------------------------------------- */}
      <form
        onSubmit={pwdForm.handleSubmit(onSubmitPwd)}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        noValidate
      >
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Réinitialiser le mot de passe
        </h2>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Nouveau mot de passe
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
            {...pwdForm.register("password")}
          />
          {pwdForm.formState.errors.password && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {pwdForm.formState.errors.password.message}
            </p>
          )}
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Le membre devra utiliser ce nouveau mot de passe pour se connecter.
          </p>
        </div>

        {pwdError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {pwdError}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pwdForm.formState.isSubmitting}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {pwdForm.formState.isSubmitting ? "Mise à jour…" : "Réinitialiser"}
          </button>
        </div>
      </form>
    </div>
  );
}
