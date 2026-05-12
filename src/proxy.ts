// Proxy Next (anciennement middleware) : rafraîchit le cookie de session Supabase Auth.
//
// Sert pour les pages/routes utilisées par admin/super-admin (auth Supabase).
// Le matcher exclut :
//   - assets statiques Next (_next/static, _next/image)
//   - favicon et autres assets binaires
//   - /api/membre/* : routes côté membre qui utilisent un JWT custom dans le
//     header Authorization (pas de cookie Supabase à rafraîchir)
//
// Cette couche ne fait PAS de redirection : la logique d'accès est gérée par
// les layouts (admin) (Server Components) qui appellent supabase.auth.getUser
// et redirigent vers /login si absent.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touche la session pour déclencher le refresh + setAll si nécessaire.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Tout sauf assets Next, fichiers binaires, et routes /api/membre/*
    "/((?!_next/static|_next/image|favicon.ico|api/membre|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
