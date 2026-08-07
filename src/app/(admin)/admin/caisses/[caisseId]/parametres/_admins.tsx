"use client";

// Bloc gestion des admins additionnels.
// L'ajout se fait par email : si un compte existe déjà, il est simplement
// lié à la caisse ; sinon il est créé à la volée (mot de passe généré,
// affiché une seule fois) — pas besoin de passer par l'espace super-admin.

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addAdminAction, removeAdminAction, resetAdminPasswordAction } from "./_actions";

const NONE = "__none__" as const;

const schema = z.object({
  email: z.email("Email invalide"),
  membreId: z.string(), // membreId ou NONE
});
type FormValues = z.infer<typeof schema>;

export function AdminsBlock({
  caisseId,
  admins,
  membresDisponibles,
  canManage,
}: {
  caisseId: string;
  admins: { userId: string; email: string; membreNom: string | null }[];
  membresDisponibles: { id: string; nom: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [resetPending, setResetPending] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", membreId: NONE },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setCreated(null);
    setResetResult(null);
    const res = await addAdminAction({
      caisseId,
      email: values.email,
      membreId: values.membreId === NONE ? null : values.membreId,
    });
    if (!res.ok) {
      setServerError(res.error);
      toast.error(res.error);
      return;
    }
    if (res.password) {
      setCreated({ email: values.email, password: res.password });
      toast.success("Compte créé et admin ajouté");
    } else {
      toast.success("Admin ajouté");
    }
    reset({ email: "", membreId: NONE });
    router.refresh();
  };

  const onRemove = (userId: string) => {
    if (!confirm("Retirer cet administrateur ?")) return;
    startTransition(async () => {
      const res = await removeAdminAction({ caisseId, userId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Admin retiré");
      router.refresh();
    });
  };

  const onResetPassword = async (userId: string, email: string) => {
    if (!confirm(`Réinitialiser le mot de passe de ${email} ?`)) return;
    setResetPending(userId);
    const res = await resetAdminPasswordAction({ caisseId, userId });
    setResetPending(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setCreated(null);
    setResetResult({ email, password: res.password });
    toast.success("Mot de passe réinitialisé");
  };

  return (
    <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Administrateurs additionnels
        </h2>
        {!canManage && (
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            (lecture seule — créateur uniquement)
          </span>
        )}
      </div>

      {created && (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
            Compte créé — note ce mot de passe, il n&apos;apparaîtra plus.
          </p>
          <dl className="space-y-1 text-sm">
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
            className="rounded-md border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
          >
            OK, noté
          </button>
        </div>
      )}

      {resetResult && (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
            Mot de passe réinitialisé — note-le, il n&apos;apparaîtra plus.
          </p>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Email</dt>
              <dd className="font-mono text-zinc-900 dark:text-zinc-50">{resetResult.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                Nouveau mot de passe
              </dt>
              <dd className="font-mono text-zinc-900 dark:text-zinc-50">{resetResult.password}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => setResetResult(null)}
            className="rounded-md border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
          >
            OK, noté
          </button>
        </div>
      )}

      {admins.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Aucun admin additionnel.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {admins.map((a) => (
            <li key={a.userId} className="flex items-center justify-between py-2 text-sm">
              <span className="text-zinc-700 dark:text-zinc-300">
                {a.email}
                {a.membreNom && (
                  <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {a.membreNom}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => onResetPassword(a.userId, a.email)}
                    disabled={resetPending === a.userId}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {resetPending === a.userId ? "…" : "Réinitialiser le mot de passe"}
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => onRemove(a.userId)}
                    disabled={pending}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Retirer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 pt-2" noValidate>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Email (compte existant, ou nouveau — sera créé automatiquement)
              </label>
              <input
                type="email"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                {...register("email")}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {isSubmitting ? "…" : "Ajouter"}
            </button>
          </div>
          {errors.email && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Lier à un membre de la caisse (optionnel)
            </label>
            <select
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              {...register("membreId")}
            >
              <option value={NONE}>— Aucun —</option>
              {membresDisponibles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </select>
          </div>
          {serverError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {serverError}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
