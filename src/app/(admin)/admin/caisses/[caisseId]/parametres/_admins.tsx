"use client";

// Bloc gestion des admins additionnels.
// L'ajout demande un email correspondant à un compte Supabase Auth existant.
// La création de comptes admin est réservée au super-admin (Phase 4.D).

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addAdminAction, removeAdminAction } from "./_actions";

const schema = z.object({ email: z.email("Email invalide") });
type FormValues = z.infer<typeof schema>;

export function AdminsBlock({
  caisseId,
  admins,
  canManage,
}: {
  caisseId: string;
  admins: { userId: string; email: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res = await addAdminAction({ caisseId, email: values.email });
    if (!res.ok) {
      setServerError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Admin ajouté");
    reset({ email: "" });
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

      {admins.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Aucun admin additionnel.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {admins.map((a) => (
            <li key={a.userId} className="flex items-center justify-between py-2 text-sm">
              <span className="text-zinc-700 dark:text-zinc-300">{a.email}</span>
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
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 pt-2" noValidate>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Email d&apos;un compte existant
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
