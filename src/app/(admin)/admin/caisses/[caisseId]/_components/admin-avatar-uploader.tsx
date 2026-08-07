"use client";

// Photo de profil du membre auquel l'admin connecté est lié
// (admins_caisse.membre_id) — même bucket Storage "avatars" et même chemin
// déterministe `${caisse_id}/${membre_id}/avatar` que côté membre, RLS
// étendue pour autoriser cet admin sur ce dossier précis (voir migration
// 20260807150000). Pas de colonne DB : l'existence de l'objet fait foi.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAdminAuth } from "@/lib/auth/admin-context";
import { Avatar } from "@/components/features/Avatar";

const MAX_SIZE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function avatarPath(caisseId: string, membreId: string): string {
  return `${caisseId}/${membreId}/avatar`;
}

export function AdminAvatarUploader({
  caisseId,
  membreId,
  size = 32,
}: {
  caisseId: string;
  membreId: string;
  size?: number;
}) {
  const { supabase } = useAdminAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchUrl = async (): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("avatars")
      .createSignedUrl(avatarPath(caisseId, membreId), SIGNED_URL_TTL_SECONDS);
    return error ? null : (data?.signedUrl ?? null);
  };

  useEffect(() => {
    let cancelled = false;
    fetchUrl().then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caisseId, membreId]);

  const onFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Format non supporté (JPEG, PNG ou WEBP)");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("Image trop lourde (3 Mo max)");
      return;
    }
    setBusy(true);
    const { error } = await supabase.storage
      .from("avatars")
      .upload(avatarPath(caisseId, membreId), file, {
        upsert: true,
        contentType: file.type,
      });
    setBusy(false);
    if (error) {
      toast.error("Envoi impossible");
      return;
    }
    toast.success("Photo de profil mise à jour");
    setUrl(await fetchUrl());
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Changer ma photo de profil"
        className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-60"
      >
        <Avatar src={url} size={size} />
        <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/50 text-[9px] font-medium text-white group-hover:flex">
          {busy ? "…" : "Changer"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
