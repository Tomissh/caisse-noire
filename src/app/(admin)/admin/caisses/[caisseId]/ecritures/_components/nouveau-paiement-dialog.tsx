"use client";

// Bouton "+ Paiement" ouvrant le formulaire de saisie en popup plutôt que de
// naviguer vers une page dédiée.

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PaiementForm } from "../paiement/new/_form";

export function NouveauPaiementDialog({
  caisseId,
  membres,
  triggerClassName = "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
}: {
  caisseId: string;
  membres: { id: string; nom: string }[];
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName}>+ Paiement</DialogTrigger>
      {open && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau paiement</DialogTitle>
          </DialogHeader>
          <PaiementForm
            caisseId={caisseId}
            membres={membres}
            onSuccess={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
