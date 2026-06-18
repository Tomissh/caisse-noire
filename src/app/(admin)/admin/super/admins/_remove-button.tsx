"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeSuperAdminAction } from "../_actions";

export function RemoveButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm("Retirer le rôle super-admin ?")) return;
    startTransition(async () => {
      const res = await removeSuperAdminAction({ userId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Super-admin retiré");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {pending ? "…" : "Retirer"}
    </button>
  );
}
