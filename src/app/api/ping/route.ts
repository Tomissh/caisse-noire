// Cron keep-alive Supabase (vercel.json, tous les 5 jours) — le free tier
// met le projet en pause après 7 jours sans requête vers son API. Un simple
// 200 sans appel à Supabase ne suffit pas : il faut une vraie requête pour
// réinitialiser le compteur d'inactivité côté Supabase.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("caisses").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, timestamp: Date.now() });
}
