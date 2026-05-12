// Layout (membre) : enveloppe les pages membre avec MembreAuthProvider qui
// lit le JWT depuis sessionStorage (côté client). Pas de garde serveur
// possible (cookie absent — c'est un header Authorization à la demande).

import { MembreAuthProvider } from "@/lib/auth/membre-context";
import { MembreTopbar } from "./_components/topbar";

export default function MembreLayout({ children }: { children: React.ReactNode }) {
  return (
    <MembreAuthProvider>
      <div className="flex flex-1 flex-col">
        <MembreTopbar />
        <main className="flex flex-1 flex-col px-6 py-8">{children}</main>
      </div>
    </MembreAuthProvider>
  );
}
