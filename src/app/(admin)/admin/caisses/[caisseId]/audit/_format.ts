// Formattage humain des actions audit_log.
// Pour les actions connues, on rend une string courte ; sinon on retombe
// sur un dump JSON collapsable côté UI.

import { centimesToEuros, formatEuros } from "@/lib/format";

type Payload = Record<string, unknown>;

export type FormattedAudit =
  | { kind: "text"; label: string; detail?: string }
  | { kind: "json"; label: string; raw: Payload };

const MOYEN_LABEL: Record<string, string> = {
  especes: "espèces",
  virement: "virement",
  autre: "autre",
};

function montantFromPayload(p: Payload, key = "montant_centimes"): string | null {
  const v = p[key];
  if (typeof v !== "number") return null;
  return formatEuros(v);
}

function libelle(p: Payload): string | null {
  const v = p["libelle"];
  return typeof v === "string" ? v : null;
}

function membreNomFromMap(
  p: Payload,
  membresById: Map<string, { nom: string }>,
): string | null {
  const v = p["membre_id"];
  if (typeof v !== "string") return null;
  const m = membresById.get(v);
  return m ? m.nom : null;
}

function diffToString(p: Payload): string {
  const parts: string[] = [];
  for (const [k, val] of Object.entries(p)) {
    if (Array.isArray(val) && val.length === 2) {
      const [oldV, newV] = val;
      const fmt = (x: unknown) => {
        if (x === null) return "∅";
        if (typeof x === "boolean") return x ? "oui" : "non";
        if (typeof x === "number" && k.includes("centimes")) {
          return `${centimesToEuros(x)}€`;
        }
        return String(x);
      };
      parts.push(`${k}: ${fmt(oldV)} → ${fmt(newV)}`);
    }
  }
  return parts.join(" · ");
}

export function formatAuditAction(
  action: string,
  payload: Payload,
  membresById: Map<string, { nom: string }>,
  emailsById: Map<string, string>,
): FormattedAudit {
  switch (action) {
    case "amende.create": {
      const m = membreNomFromMap(payload, membresById);
      const lib = libelle(payload);
      const mt = montantFromPayload(payload);
      return {
        kind: "text",
        label: "Amende déclarée",
        detail: [m, lib, mt].filter(Boolean).join(" — "),
      };
    }
    case "amende.delete": {
      return {
        kind: "text",
        label: "Amende supprimée",
        detail: typeof payload["motif_suppression"] === "string"
          ? `motif : ${payload["motif_suppression"]}`
          : undefined,
      };
    }
    case "paiement.create": {
      const m = membreNomFromMap(payload, membresById);
      const mt = montantFromPayload(payload);
      const moy =
        typeof payload["moyen"] === "string" ? MOYEN_LABEL[payload["moyen"]] ?? payload["moyen"] : null;
      return {
        kind: "text",
        label: "Paiement enregistré",
        detail: [m, mt, moy].filter(Boolean).join(" — "),
      };
    }
    case "paiement.delete": {
      return {
        kind: "text",
        label: "Paiement supprimé",
        detail: typeof payload["motif_suppression"] === "string"
          ? `motif : ${payload["motif_suppression"]}`
          : undefined,
      };
    }
    case "retrait.create": {
      const lib = libelle(payload);
      const mt = montantFromPayload(payload);
      return {
        kind: "text",
        label: "Retrait enregistré",
        detail: [lib, mt].filter(Boolean).join(" — "),
      };
    }
    case "pack.create": {
      const m = membreNomFromMap(payload, membresById);
      const verbe = payload["delta"] === -1 ? "retiré" : "ajouté";
      return { kind: "text", label: `Pack ${verbe}`, detail: m ?? undefined };
    }
    case "caisse.create": {
      return {
        kind: "text",
        label: "Caisse créée",
        detail: typeof payload["nom"] === "string" ? payload["nom"] : undefined,
      };
    }
    case "caisse.cloture":
      return { kind: "text", label: "Caisse clôturée" };
    case "caisse.reouverture":
      return { kind: "text", label: "Caisse réouverte" };
    case "caisse.update": {
      return { kind: "text", label: "Caisse modifiée", detail: diffToString(payload) };
    }
    case "caisse.delete":
      return { kind: "text", label: "Caisse supprimée" };
    case "membre.create": {
      const n = typeof payload["nom"] === "string" ? payload["nom"] : "";
      return { kind: "text", label: "Membre ajouté", detail: n };
    }
    case "membre.update":
      return { kind: "text", label: "Membre modifié", detail: diffToString(payload) };
    case "membre.set_password":
      return { kind: "text", label: "Mot de passe membre modifié" };
    case "membre.delete": {
      const n = typeof payload["nom"] === "string" ? payload["nom"] : "";
      return { kind: "text", label: "Membre supprimé", detail: n };
    }
    case "motif.create": {
      const lib = libelle(payload);
      const mt = montantFromPayload(payload);
      return { kind: "text", label: "Motif créé", detail: [lib, mt].filter(Boolean).join(" — ") };
    }
    case "motif.update":
      return { kind: "text", label: "Motif modifié", detail: diffToString(payload) };
    case "motif.deactivate":
      return { kind: "text", label: "Motif désactivé" };
    case "motif.reactivate":
      return { kind: "text", label: "Motif réactivé" };
    case "motif.delete": {
      const lib = libelle(payload);
      return { kind: "text", label: "Motif supprimé", detail: lib ?? undefined };
    }
    case "admin.add": {
      const uid = typeof payload["user_id"] === "string" ? payload["user_id"] : null;
      const email = uid ? emailsById.get(uid) ?? `${uid.slice(0, 8)}…` : null;
      return { kind: "text", label: "Admin ajouté", detail: email ?? undefined };
    }
    case "admin.remove": {
      const uid = typeof payload["user_id"] === "string" ? payload["user_id"] : null;
      const email = uid ? emailsById.get(uid) ?? `${uid.slice(0, 8)}…` : null;
      return { kind: "text", label: "Admin retiré", detail: email ?? undefined };
    }
    default:
      return { kind: "json", label: action, raw: payload };
  }
}

export const ACTION_OPTIONS = [
  { value: "", label: "Toutes les actions" },
  { value: "amende.create", label: "Amende — création" },
  { value: "amende.delete", label: "Amende — suppression" },
  { value: "paiement.create", label: "Paiement — création" },
  { value: "paiement.delete", label: "Paiement — suppression" },
  { value: "retrait.create", label: "Retrait — création" },
  { value: "pack.create", label: "Pack — mouvement" },
  { value: "caisse.create", label: "Caisse — création" },
  { value: "caisse.update", label: "Caisse — modification" },
  { value: "caisse.cloture", label: "Caisse — clôture" },
  { value: "caisse.reouverture", label: "Caisse — réouverture" },
  { value: "membre.create", label: "Membre — ajout" },
  { value: "membre.update", label: "Membre — modification" },
  { value: "membre.set_password", label: "Membre — mot de passe" },
  { value: "membre.delete", label: "Membre — suppression" },
  { value: "motif.create", label: "Motif — création" },
  { value: "motif.update", label: "Motif — modification" },
  { value: "motif.deactivate", label: "Motif — désactivation" },
  { value: "motif.reactivate", label: "Motif — réactivation" },
  { value: "motif.delete", label: "Motif — suppression" },
  { value: "admin.add", label: "Admin — ajout" },
  { value: "admin.remove", label: "Admin — retrait" },
];
