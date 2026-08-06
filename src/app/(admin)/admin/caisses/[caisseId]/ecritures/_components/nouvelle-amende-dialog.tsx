"use client";

// Bouton "+ Amende" ouvrant le formulaire de saisie en popup plutôt que de
// naviguer vers une page dédiée — évite de perdre le contexte (dashboard ou
// liste des écritures) pendant la saisie.

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AmendeForm } from "../amende/new/_form";

type MotifOption = {
  id: string;
  libelle: string;
  montantEuros: number;
  montantVariable: boolean;
};

type MembreOption = { id: string; nom: string };

export function NouvelleAmendeDialog({
  caisseId,
  motifs,
  membres,
  triggerClassName = "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
}: {
  caisseId: string;
  motifs: MotifOption[];
  membres: MembreOption[];
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName}>+ Amende</DialogTrigger>
      {open && (
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nouvelle amende</DialogTitle>
          </DialogHeader>
          {membres.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Aucun membre actif. Ajoutez d&apos;abord un membre.
            </p>
          ) : (
            <AmendeForm
              caisseId={caisseId}
              motifs={motifs}
              membres={membres}
              onSuccess={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
