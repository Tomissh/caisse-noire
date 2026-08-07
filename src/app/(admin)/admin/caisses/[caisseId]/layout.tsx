// Layout d'une caisse : sidebar fixe desktop + drawer mobile.
// La garde requireCaisseAdmin fait la vérification d'accès côté serveur.

import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { CaisseSidebar } from "./_components/sidebar";

export default async function CaisseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ caisseId: string }>;
}) {
  const { caisseId } = await params;
  const ctx = await requireCaisseAdmin(caisseId);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <CaisseSidebar
        caisseId={ctx.caisse.id}
        nom={ctx.caisse.nom}
        code={ctx.caisse.code}
        cloturee={Boolean(ctx.caisse.cloturee_at)}
        role={ctx.role}
        membreId={ctx.membreId}
      />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
