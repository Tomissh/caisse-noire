// Route group (public) : pas d'auth requise (landing, login admin, login membre,
// futur set-password). Le rendu est délégué aux pages.

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
