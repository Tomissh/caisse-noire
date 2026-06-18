"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addSuperAdminAction } from "../_actions";

const schema = z.object({ email: z.email("Email invalide") });
type Values = z.infer<typeof schema>;

export function AddSuperAdminForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (v: Values) => {
    setServerError(null);
    const res = await addSuperAdminAction(v);
    if (!res.ok) {
      setServerError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Super-admin ajouté");
    reset({ email: "" });
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex items-start gap-2" noValidate>
      <div className="flex-1 space-y-1">
        <input
          type="email"
          placeholder="email@exemple.fr"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>
        )}
        {serverError && (
          <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {serverError}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Ajouter
      </button>
    </form>
  );
}
