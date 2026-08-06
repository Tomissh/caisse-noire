"use client";

// Bouton "+ Retrait" ouvrant le formulaire de saisie en popup plutôt que de
// naviguer vers une page dédiée.

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RetraitForm } from "../retrait/new/_form";

export function NouveauRetraitDialog({
  caisseId,
  triggerClassName = "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
}: {
  caisseId: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName}>+ Retrait</DialogTrigger>
      {open && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau retrait</DialogTitle>
          </DialogHeader>
          <RetraitForm
            caisseId={caisseId}
            onSuccess={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
