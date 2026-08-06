// Avatar rond réutilisable : affiche `src` si fourni, sinon un pictogramme
// générique (silhouette grise) — même rendu pour tous tant qu'aucune photo
// n'a été envoyée.

export function Avatar({
  src,
  size = 40,
  alt = "",
  className = "",
}: {
  src?: string | null;
  size?: number;
  alt?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700 ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar signé, taille dynamique, pas de domaine fixe pour next/image
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <DefaultAvatarIcon />
      )}
    </span>
  );
}

function DefaultAvatarIcon() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
      <defs>
        <clipPath id="avatar-circle-clip">
          <circle cx="100" cy="100" r="100" />
        </clipPath>
      </defs>
      <g clipPath="url(#avatar-circle-clip)">
        <circle cx="100" cy="100" r="100" fill="#9CA3AF" />
        <circle cx="100" cy="82" r="34" fill="#F1F2F4" />
        <ellipse cx="100" cy="192" rx="58" ry="62" fill="#F1F2F4" />
      </g>
    </svg>
  );
}
